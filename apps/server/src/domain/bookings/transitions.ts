import { canTransition, type BookingActor, type BookingStatus } from "@hagz/contracts";
import { prisma } from "@/db/prisma";

export class InvalidTransitionError extends Error {
  constructor(from: BookingStatus, to: BookingStatus, actor: BookingActor) {
    super(`Booking cannot go from "${from}" to "${to}" by ${actor}`);
  }
}

export class StaleTransitionError extends Error {
  constructor(bookingId: string, from: BookingStatus) {
    super(`Booking ${bookingId} is no longer "${from}"`);
  }
}

type TransitionInput = {
  bookingId: string;
  from: BookingStatus;
  to: BookingStatus;
  actor: BookingActor;
  actorId?: string;
  reason?: string;
};

// The only way a booking's status may change.
export const transitionBooking = async ({ bookingId, from, to, actor, actorId, reason }: TransitionInput) => {
  if (!canTransition(from, to, actor)) throw new InvalidTransitionError(from, to, actor);

  return prisma.$transaction(async (tx) => {
    // Conditional update: if someone else changed the status first, nothing matches.
    const { count } = await tx.booking.updateMany({
      where: { id: bookingId, status: from },
      data: { status: to },
    });
    if (count === 0) throw new StaleTransitionError(bookingId, from);

    await tx.bookingEvent.create({
      data: { bookingId, fromStatus: from, toStatus: to, actorRole: actor, actorId, reason },
    });
  });
};
