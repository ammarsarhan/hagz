import type { CancellationTier, CreateHold, CreateStaffBooking } from "@hagz/contracts";
import {
  assignSlots,
  HORIZON_DAYS,
  lockFreeSlots,
  resolvedTiers,
  walkInCustomer,
  type VenueAccess,
} from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { createIdempotently, type IdempotentResult } from "@/platform/idempotency/idempotency";
import { requireMobileNumber } from "@/platform/phone/phone";
import { adjustedTo, priceBooking, type PricedAmenity } from "../domain/charges";
import { BOOKING_EVENTS } from "../domain/events";
import { checkLength, checkRange, coversExactly, slotUnavailable } from "../domain/rules";
import { newCode, withFreshCode } from "./booking-rows";
import { targetGround } from "./rescheduling";

// Bookings staff enter themselves (docs/rescheduling.md "Holding slots", PR 4.3): a hold for someone
// deciding, or a walk-in or phone booking, confirmed at once. Both are for one of the venue's
// customers (or a new one by name and number), paid at the venue with no commission, and can start
// right up to kick-off: the minimum notice is for players booking in the app.

const IDEMPOTENCY_INDEX = "Booking_venueId_idempotencyKey_key";

const venueClosed = (venueStatus: string) =>
  new AppError({
    code: "VENUE_STATUS_CONFLICT",
    status: 409,
    detail: "Bookings can be entered once the venue is live.",
    extensions: { venueStatus },
  });

const customerNotFound = () =>
  new AppError({
    code: "CUSTOMER_NOT_FOUND",
    status: 404,
    detail: "This venue has no such customer.",
  });

const amenityUnavailable = () =>
  new AppError({
    code: "AMENITY_NOT_AVAILABLE",
    status: 422,
    detail: "One of the extras isn't offered for a price at this venue.",
  });

type Customer = CreateHold["customer"];

// The customer by id, or by number (normalized before anything is locked).
const normalized = (customer: Customer): Customer =>
  "phone" in customer
    ? { name: customer.name, phone: requireMobileNumber(customer.phone).e164 }
    : customer;

const customerFor = async (tx: Tx, venueId: string, customer: Customer) => {
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

const loadVenue = async (venueId: string) => {
  const venue = await prisma.venue.findUniqueOrThrow({
    where: { id: venueId },
    select: {
      status: true,
      taxNumber: true,
      marketplace: { select: { taxRate: true } },
      settings: {
        select: { staffHoldMinutes: true, cancellationPolicy: true, cancellationTiers: true },
      },
      amenities: {
        where: { price: { not: null } },
        select: { optionId: true, price: true, pricing: true },
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
    throw new Error(`Live venue ${venueId} has no cancellation policy.`);
  }
  return {
    taxRate: venue.taxNumber ? venue.marketplace.taxRate : 0,
    holdMinutes: settings.staffHoldMinutes,
    policy: settings.cancellationPolicy,
    tiers,
    amenities: venue.amenities,
  };
};

interface Entry {
  groundId: string;
  startsAt: string;
  endsAt: string;
  customer: Customer;
  amenities?: readonly string[];
  total?: number;
  note?: string;
}

// Writes the booking in one transaction with its slots claimed. `hold`: HELD for staffHoldMinutes;
// otherwise CONFIRMED with its slots booked.
const enter = async (
  actor: VenueAccess,
  entry: Entry,
  { hold, idempotencyKey }: { hold: boolean; idempotencyKey: string | null },
  now: Date,
): Promise<string> => {
  const venue = await loadVenue(actor.venueId);
  const startsAt = new Date(entry.startsAt);
  const endsAt = new Date(entry.endsAt);
  checkRange(startsAt, endsAt, { now, minimumNotice: 0, horizonDays: HORIZON_DAYS });
  const amenities: PricedAmenity[] = [...new Set(entry.amenities ?? [])].map((optionId) => {
    const offered = venue.amenities.find((amenity) => amenity.optionId === optionId);
    if (offered?.price == null || offered.pricing === null) throw amenityUnavailable();
    return { optionId, price: offered.price, pricing: offered.pricing };
  });
  const customer = normalized(entry.customer);
  const status = hold ? "HELD" : "CONFIRMED";

  return withFreshCode(() =>
    transaction(async (tx) => {
      const ground = await targetGround(tx, actor.venueId, entry.groundId);
      const customerId = await customerFor(tx, actor.venueId, customer);
      const slots = await lockFreeSlots(tx, ground.id, startsAt, endsAt);
      if (!coversExactly(slots, startsAt, endsAt)) throw slotUnavailable();
      checkLength(slots.length, ground.minimumSlots, ground.maximumSlots);
      const priced = priceBooking(slots, amenities, venue.taxRate);
      const price =
        entry.total === undefined ? priced : adjustedTo(priced, entry.total, venue.taxRate);
      const { id } = await tx.booking.create({
        data: {
          venueId: actor.venueId,
          groundId: ground.id,
          customerId,
          creatorId: actor.staffId,
          code: newCode(),
          status,
          startsAt,
          endsAt,
          note: entry.note === "" ? null : (entry.note ?? null),
          expiresAt: hold ? new Date(now.getTime() + venue.holdMinutes * 60_000) : null,
          idempotencyKey,
          total: price.total,
          paymentMode: "MANUAL",
          commissionRate: 0,
          cancellationPolicy: venue.policy,
          cancellationTiers: venue.tiers,
          charges: {
            create: price.lines.map((line) => ({
              type: line.type,
              startsAt: line.startsAt,
              tier: line.tier,
              optionId: line.optionId,
              pricing: line.pricing,
              amount: line.amount,
              taxRate: line.taxRate,
              taxAmount: line.taxAmount,
            })),
          },
          events: {
            create: {
              type: BOOKING_EVENTS.CREATED,
              staffId: actor.staffId,
              data: hold ? { status, hold: true } : { status },
            },
          },
        },
        select: { id: true },
      });
      await assignSlots(
        tx,
        slots.map((slot) => slot.id),
        id,
        hold ? "HELD" : "BOOKED",
      );
      return id;
    }),
  );
};

// Holds free slots for someone. Returns the hold's booking id.
export const createHold = (
  actor: VenueAccess,
  body: CreateHold,
  clock: Clock = systemClock,
): Promise<string> => enter(actor, body, { hold: true, idempotencyKey: null }, clock.now());

interface StoredKey {
  id: string;
  creatorId: string | null;
  groundId: string;
  startsAt: Date;
  endsAt: Date;
}

// A walk-in or phone booking, at the slots' prices or the venue's own total. A retry with the same
// Idempotency-Key gets the same booking back.
export const createStaffBooking = async (
  actor: VenueAccess,
  body: CreateStaffBooking,
  idempotencyKey: string,
  clock: Clock = systemClock,
): Promise<IdempotentResult<string>> => {
  const find = () =>
    prisma.booking.findUnique({
      where: { venueId_idempotencyKey: { venueId: actor.venueId, idempotencyKey } },
      select: { id: true, creatorId: true, groundId: true, startsAt: true, endsAt: true },
    });
  const matches = (existing: StoredKey) =>
    existing.creatorId === actor.staffId &&
    existing.groundId === body.groundId &&
    existing.startsAt.getTime() === new Date(body.startsAt).getTime() &&
    existing.endsAt.getTime() === new Date(body.endsAt).getTime();
  const create = async (): Promise<StoredKey> => {
    const id = await enter(actor, body, { hold: false, idempotencyKey }, clock.now());
    return {
      id,
      creatorId: actor.staffId,
      groundId: body.groundId,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
    };
  };
  try {
    const { value, replayed } = await createIdempotently({
      index: IDEMPOTENCY_INDEX,
      find,
      matches,
      create,
    });
    return { value: value.id, replayed };
  } catch (error) {
    // A retry racing its own first attempt finds the slots taken by it: answer with that booking.
    if (!(error instanceof AppError) || error.code !== "SLOT_UNAVAILABLE") throw error;
    const original = await find();
    if (!original || !matches(original)) throw error;
    return { value: original.id, replayed: true };
  }
};
