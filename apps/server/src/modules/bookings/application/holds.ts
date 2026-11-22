import type { CancellationTier, CreateHold } from "@hagz/contracts";
import {
  assignSlots,
  bookHeldSlots,
  HORIZON_DAYS,
  lockFreeSlots,
  releaseSlots,
  resolvedTiers,
  walkInCustomer,
  type VenueAccess,
} from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { requireMobileNumber } from "@/platform/phone/phone";
import { priceBooking } from "../domain/charges";
import { BOOKING_EVENTS } from "../domain/events";
import { checkLength, checkRange, coversExactly, slotUnavailable } from "../domain/rules";
import { invalidTransition } from "../domain/status";
import { lockBooking, newCode, withFreshCode } from "./booking-rows";
import { targetGround } from "./rescheduling";

// Staff holds (PR 4.8, docs/rescheduling.md "Holding slots"): while staff are on the phone with
// someone deciding, or confirming a move with a customer, they keep the slots as a HELD booking of
// their own for staffHoldMinutes. It can be confirmed, extended once, or released; otherwise the
// expiry sweep frees it like any unpaid hold. Entered by staff, so no commission and nothing to pay
// through Hagz.

const venueClosed = (venueStatus: string) =>
  new AppError({
    code: "VENUE_STATUS_CONFLICT",
    status: 409,
    detail: "Slots can be held once the venue is live.",
    extensions: { venueStatus },
  });

const customerNotFound = () =>
  new AppError({
    code: "CUSTOMER_NOT_FOUND",
    status: 404,
    detail: "This venue has no such customer.",
  });

const holdNotFound = () =>
  new AppError({ code: "HOLD_NOT_FOUND", status: 404, detail: "There's no such hold here." });

const alreadyExtended = () =>
  new AppError({
    code: "HOLD_ALREADY_EXTENDED",
    status: 409,
    detail: "A hold can be extended once. Confirm it or let it go.",
  });

const customerFor = async (tx: Tx, venueId: string, customer: CreateHold["customer"]) => {
  if ("venueCustomerId" in customer) {
    const known = await tx.venueCustomer.findFirst({
      where: { id: customer.venueCustomerId, venueId },
      select: { id: true },
    });
    if (!known) throw customerNotFound();
    return known.id;
  }
  return walkInCustomer(tx, venueId, customer);
};

// Holds free slots for someone (the number is normalized before it's looked up). Returns the hold's booking id.
export const createHold = async (
  actor: VenueAccess,
  body: CreateHold,
  clock: Clock = systemClock,
): Promise<string> => {
  const now = clock.now();
  const venue = await prisma.venue.findUniqueOrThrow({
    where: { id: actor.venueId },
    select: {
      status: true,
      taxNumber: true,
      marketplace: { select: { taxRate: true } },
      settings: {
        select: { staffHoldMinutes: true, cancellationPolicy: true, cancellationTiers: true },
      },
    },
  });
  if (venue.status !== "LIVE" && venue.status !== "MAINTENANCE") throw venueClosed(venue.status);
  const settings = venue.settings;
  const tiers =
    settings &&
    resolvedTiers(
      settings.cancellationPolicy,
      settings.cancellationTiers as CancellationTier[] | null,
    );
  if (!settings?.cancellationPolicy || !tiers) {
    throw new Error(`Live venue ${actor.venueId} has no cancellation policy.`);
  }
  const policy = settings.cancellationPolicy;

  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  // Staff can hold right up to kick-off: the minimum notice is for players booking in the app.
  checkRange(startsAt, endsAt, { now, minimumNotice: 0, horizonDays: HORIZON_DAYS });
  const customer =
    "phone" in body.customer
      ? { name: body.customer.name, phone: requireMobileNumber(body.customer.phone).e164 }
      : body.customer;

  return withFreshCode(() =>
    transaction(async (tx) => {
      const ground = await targetGround(tx, actor.venueId, body.groundId);
      const customerId = await customerFor(tx, actor.venueId, customer);
      const slots = await lockFreeSlots(tx, ground.id, startsAt, endsAt);
      if (!coversExactly(slots, startsAt, endsAt)) throw slotUnavailable();
      checkLength(slots.length, ground.minimumSlots, ground.maximumSlots);
      const price = priceBooking(slots, [], venue.taxNumber ? venue.marketplace.taxRate : 0);
      const { id } = await tx.booking.create({
        data: {
          venueId: actor.venueId,
          groundId: ground.id,
          customerId,
          creatorId: actor.staffId,
          code: newCode(),
          status: "HELD",
          startsAt,
          endsAt,
          expiresAt: new Date(now.getTime() + settings.staffHoldMinutes * 60_000),
          total: price.total,
          paymentMode: "MANUAL",
          commissionRate: 0,
          cancellationPolicy: policy,
          cancellationTiers: tiers,
          charges: {
            create: price.lines.map((line) => ({
              type: line.type,
              startsAt: line.startsAt,
              tier: line.tier,
              amount: line.amount,
              taxRate: line.taxRate,
              taxAmount: line.taxAmount,
            })),
          },
          events: {
            create: {
              type: BOOKING_EVENTS.CREATED,
              staffId: actor.staffId,
              data: { status: "HELD", hold: true },
            },
          },
        },
        select: { id: true },
      });
      await assignSlots(
        tx,
        slots.map((slot) => slot.id),
        id,
        "HELD",
      );
      return id;
    }),
  );
};

const lockHold = async (
  tx: Tx,
  actor: VenueAccess,
  bookingId: string,
  attempted: "CONFIRMED" | "EXPIRED" | "HELD",
  now: Date,
) => {
  const hold = await lockBooking(tx, bookingId, actor.venueId, {
    id: true,
    status: true,
    creatorId: true,
    expiresAt: true,
    venue: { select: { settings: { select: { staffHoldMinutes: true } } } },
  });
  if (!hold?.creatorId) throw holdNotFound();
  if (hold.status !== "HELD") throw invalidTransition(hold.status, attempted);
  if (!hold.expiresAt || hold.expiresAt <= now) throw invalidTransition("EXPIRED", attempted);
  return { ...hold, expiresAt: hold.expiresAt };
};

// The customer said yes: the hold becomes a confirmed booking.
export const confirmHold = async (
  actor: VenueAccess,
  bookingId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const hold = await lockHold(tx, actor, bookingId, "CONFIRMED", now);
    await tx.booking.update({
      where: { id: hold.id },
      data: { status: "CONFIRMED", expiresAt: null },
    });
    await bookHeldSlots(tx, hold.id);
    await tx.bookingEvent.create({
      data: { bookingId: hold.id, type: BOOKING_EVENTS.CONFIRMED, staffId: actor.staffId },
    });
  });
};

// Another staffHoldMinutes on top of the deadline, once, so a hold can't keep slots off sale for
// long.
export const extendHold = async (
  actor: VenueAccess,
  bookingId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const hold = await lockHold(tx, actor, bookingId, "HELD", now);
    const extended = await tx.bookingEvent.findFirst({
      where: { bookingId: hold.id, type: BOOKING_EVENTS.HOLD_EXTENDED },
      select: { id: true },
    });
    if (extended) throw alreadyExtended();
    const minutes = hold.venue.settings?.staffHoldMinutes ?? 15;
    const expiresAt = new Date(hold.expiresAt.getTime() + minutes * 60_000);
    await tx.booking.update({ where: { id: hold.id }, data: { expiresAt } });
    await tx.bookingEvent.create({
      data: {
        bookingId: hold.id,
        type: BOOKING_EVENTS.HOLD_EXTENDED,
        staffId: actor.staffId,
        data: { expiresAt: expiresAt.toISOString() },
      },
    });
  });
};

// Lets the slots go at once. Ends EXPIRED, as if it had run out: a hold that didn't become a
// booking isn't a cancellation.
export const releaseHold = async (
  actor: VenueAccess,
  bookingId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const hold = await lockHold(tx, actor, bookingId, "EXPIRED", now);
    await tx.booking.update({ where: { id: hold.id }, data: { status: "EXPIRED" } });
    await releaseSlots(tx, [hold.id], now);
    await tx.bookingEvent.create({
      data: { bookingId: hold.id, type: BOOKING_EVENTS.HOLD_RELEASED, staffId: actor.staffId },
    });
  });
};
