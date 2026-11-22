import type { BookingQuote, BookingRequest, CreateBooking } from "@hagz/contracts";
import type { Language } from "@/generated/prisma/enums";
import { assignSlots, lockFreeSlots, venueCustomerForAccount } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { createIdempotently, type IdempotentResult } from "@/platform/idempotency/idempotency";
import { depositFor, priceBooking } from "../domain/charges";
import { BOOKING_EVENTS } from "../domain/events";
import { checkLength, coversExactly, slotUnavailable } from "../domain/rules";
import { startOf } from "../domain/status";
import { newCode, withFreshCode } from "./booking-rows";
import { bookingTerms, type BookingTerms } from "./booking-terms";
import { amenityNames, presentCharge } from "./booking-view";

// A player books in the app (PR 4.1). The slots are locked before anything is written, so of many
// players racing for one slot exactly one gets it and the rest get 409 SLOT_UNAVAILABLE at once
// (docs/architecture.md, "No double bookings"). The booking copies its terms (prices, VAT, payment
// mode, commission, cancellation tiers) and never changes them.

const IDEMPOTENCY_INDEX = "Booking_venueId_idempotencyKey_key";

const accountUnavailable = () =>
  new AppError({
    code: "ACCOUNT_SUSPENDED",
    status: 403,
    detail: "This account can't make bookings.",
  });

const priced = (terms: BookingTerms, slots: Parameters<typeof priceBooking>[0], now: Date) => {
  checkLength(slots.length, terms.minimumSlots, terms.maximumSlots);
  const price = priceBooking(slots, terms.amenities, terms.taxRate);
  // Nothing to collect online for a free booking: it's settled like a pay-at-venue one.
  const paymentMode = price.total > 0 ? terms.paymentMode : "MANUAL";
  const deposit =
    paymentMode === "DEPOSIT" && terms.depositPercent !== null
      ? depositFor(price.total, terms.depositPercent)
      : null;
  const start = startOf({
    autoConfirm: terms.autoConfirm,
    paymentMode,
    total: price.total,
    now,
    startsAt: terms.startsAt,
    minimumNotice: terms.minimumNotice,
    paymentWindow: terms.paymentWindow,
  });
  return { ...price, paymentMode, deposit, start };
};

// The price of a booking before it's made, for the review step. Reads the free slots without
// locking them, so it can be out of date by the time the player books; booking checks again.
export const quoteBooking = async (
  request: BookingRequest,
  language: Language,
  clock: Clock = systemClock,
): Promise<BookingQuote> => {
  const now = clock.now();
  const terms = await bookingTerms(request, now);
  const slots = await prisma.groundSlot.findMany({
    where: {
      groundId: terms.groundId,
      startsAt: { gte: terms.startsAt, lt: terms.endsAt },
      status: "AVAILABLE",
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, endsAt: true, tier: true, price: true },
  });
  if (!coversExactly(slots, terms.startsAt, terms.endsAt)) throw slotUnavailable();
  const quote = priced(terms, slots, now);
  const optionNames = await amenityNames(
    terms.amenities.map((amenity) => amenity.optionId),
    language,
  );
  return {
    currency: terms.currency,
    total: quote.total,
    tax: quote.tax,
    paymentMode: quote.paymentMode,
    deposit: quote.deposit,
    startsAs: quote.start.status,
    charges: quote.lines.map((line) => presentCharge(line, (id) => optionNames.get(id) ?? null)),
  };
};

interface StoredKey {
  id: string;
  groundId: string;
  startsAt: Date;
  endsAt: Date;
  customer: { customerId: string | null };
}

// Books for a signed-in player. Returns the booking's id; a retry with the same Idempotency-Key gets
// the same booking back (replayed).
export const createBooking = async (
  customerId: string,
  request: CreateBooking,
  idempotencyKey: string,
  clock: Clock = systemClock,
): Promise<IdempotentResult<string>> => {
  const account = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, phone: true, status: true },
  });
  if (account?.status !== "ACTIVE" || !account.phone) throw accountUnavailable();
  const phone = account.phone;

  const now = clock.now();
  const terms = await bookingTerms(request, now);

  const find = () =>
    prisma.booking.findUnique({
      where: { venueId_idempotencyKey: { venueId: terms.venueId, idempotencyKey } },
      select: {
        id: true,
        groundId: true,
        startsAt: true,
        endsAt: true,
        customer: { select: { customerId: true } },
      },
    });
  const matches = (existing: StoredKey) =>
    existing.customer.customerId === account.id &&
    existing.groundId === terms.groundId &&
    existing.startsAt.getTime() === terms.startsAt.getTime() &&
    existing.endsAt.getTime() === terms.endsAt.getTime();

  const insert = () =>
    transaction(async (tx) => {
      const slots = await lockFreeSlots(tx, terms.groundId, terms.startsAt, terms.endsAt);
      if (!coversExactly(slots, terms.startsAt, terms.endsAt)) throw slotUnavailable();
      const booking = priced(terms, slots, now);
      const venueCustomerId = await venueCustomerForAccount(tx, terms.venueId, {
        id: account.id,
        name: account.name,
        phone,
      });
      const { id } = await tx.booking.create({
        data: {
          venueId: terms.venueId,
          groundId: terms.groundId,
          customerId: venueCustomerId,
          code: newCode(),
          status: booking.start.status,
          startsAt: terms.startsAt,
          endsAt: terms.endsAt,
          note: request.note === "" ? null : (request.note ?? null),
          expiresAt: booking.start.expiresAt,
          idempotencyKey,
          total: booking.total,
          depositAmount: booking.deposit,
          paymentMode: booking.paymentMode,
          commissionRate: terms.commissionRate,
          cancellationPolicy: terms.cancellationPolicy,
          cancellationTiers: terms.cancellationTiers,
          charges: {
            create: booking.lines.map((line) => ({
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
              customerId: account.id,
              data: { status: booking.start.status },
            },
          },
        },
        select: { id: true },
      });
      await assignSlots(
        tx,
        slots.map((slot) => slot.id),
        id,
        booking.start.status === "CONFIRMED" ? "BOOKED" : "HELD",
      );
      const stored: StoredKey = {
        id,
        groundId: terms.groundId,
        startsAt: terms.startsAt,
        endsAt: terms.endsAt,
        customer: { customerId: account.id },
      };
      return stored;
    });

  // The slot claim should make an overlapping booking impossible; if the database ever refuses one,
  // to the player it's a taken slot.
  const create = () => withFreshCode(insert);

  try {
    const { value, replayed } = await createIdempotently({
      index: IDEMPOTENCY_INDEX,
      find,
      matches,
      create,
    });
    return { value: value.id, replayed };
  } catch (error) {
    // A retry racing its own first attempt queues on the same slot locks and then finds the slots
    // taken by that attempt. Answer with it, as for any retry.
    if (!(error instanceof AppError) || error.code !== "SLOT_UNAVAILABLE") throw error;
    const original = await find();
    if (!original || !matches(original)) throw error;
    return { value: original.id, replayed: true };
  }
};
