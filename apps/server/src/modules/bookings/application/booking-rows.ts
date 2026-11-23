import { randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { isExclusionViolation, violatedUniqueIndex } from "@/platform/db/errors";
import type { Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { bookingCode } from "../domain/events";
import { slotUnavailable } from "../domain/rules";

// What the booking use cases share: locking a booking row, new share codes, and what was paid.

const CODE_INDEX = "Booking_code_key";

export const venueBookingNotFound = () =>
  new AppError({
    code: "BOOKING_NOT_FOUND",
    status: 404,
    detail: "There's no such booking at this venue.",
  });

// The player's own booking, not found: anyone else's answers as if it didn't exist.
export const bookingNotFound = () =>
  new AppError({
    code: "BOOKING_NOT_FOUND",
    status: 404,
    detail: "No booking of yours with that id.",
  });

export const newCode = () => bookingCode(randomInt);

// Runs an insert again with a new share code when its code was taken (about one in 10^12). An
// overlapping live booking the database refused is, to the caller, a taken slot.
export const withFreshCode = async <T>(insert: () => Promise<T>): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await insert();
    } catch (error) {
      if (violatedUniqueIndex(error) === CODE_INDEX && attempt < 3) continue;
      if (isExclusionViolation(error)) throw slotUnavailable();
      throw error;
    }
  }
};

// Locks booking rows (in id order, so two transactions locking the same pair can't deadlock) and
// reads them after the lock. Bookings at another venue, or not there, are left out.
export const lockBookings = async <S extends Prisma.BookingSelect>(
  tx: Tx,
  ids: readonly string[],
  venueId: string | null,
  select: S,
) => {
  const sorted = [...new Set(ids)].sort();
  await tx.$queryRaw`
    SELECT id FROM "Booking" WHERE id = ANY(${sorted}::uuid[]) ORDER BY id FOR UPDATE`;
  return tx.booking.findMany({
    where: { id: { in: sorted }, ...(venueId && { venueId }) },
    select,
  });
};

export const lockBooking = async <S extends Prisma.BookingSelect>(
  tx: Tx,
  id: string,
  venueId: string | null,
  select: S,
) => {
  const [booking] = await lockBookings(tx, [id], venueId, select);
  return booking;
};

// Paid online on these bookings, net: succeeded payments less their succeeded refunds.
export const netPaid = async (tx: Tx, bookingIds: readonly string[]): Promise<number> => {
  const payments = await tx.payment.findMany({
    where: { bookingId: { in: [...bookingIds] }, status: "SUCCEEDED" },
    select: { amount: true, refunds: { where: { status: "SUCCEEDED" }, select: { amount: true } } },
  });
  return payments.reduce(
    (sum, payment) =>
      sum +
      payment.amount -
      payment.refunds.reduce((refunded, refund) => refunded + refund.amount, 0),
    0,
  );
};

// A booking and the ones it was moved or swapped from, newest first: payments stay on the booking
// they were made on, so what a booking has been paid is the sum along this chain.
export const moveChain = async (tx: Tx, bookingId: string): Promise<string[]> => {
  const chain = [bookingId];
  for (;;) {
    const origin = await tx.rescheduling.findFirst({
      where: { toBookingId: chain.at(-1) },
      select: { type: true, fromBookingId: true },
    });
    if (!origin || origin.type === "REFILL") return chain;
    chain.push(origin.fromBookingId);
  }
};
