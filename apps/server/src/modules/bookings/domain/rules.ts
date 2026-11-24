import { AppError } from "@/platform/errors/app-error";

// When a range of a ground's time can be booked (PR 4.1). Pure: the use case passes in the slots it
// locked and the venue's settings, and every edge is unit-tested.

export interface ClaimedSlot {
  id: string;
  startsAt: Date;
  endsAt: Date;
}

export const slotUnavailable = () =>
  new AppError({
    code: "SLOT_UNAVAILABLE",
    status: 409,
    detail: "That time was just taken, or isn't open for booking.",
  });

const invalidRange = (detail: string, extensions: Record<string, unknown> = {}) =>
  new AppError({ code: "INVALID_BOOKING_TIME", status: 422, detail, extensions });

// Whether the slots run back to back from `from` to `to` with no gap. They're the AVAILABLE slots
// starting inside the range, in startsAt order; one missing (taken, blocked or never there) leaves a
// gap, and a last slot running past `to` means the range ends mid-slot.
export const coversExactly = (slots: readonly ClaimedSlot[], from: Date, to: Date): boolean => {
  let cursor = from.getTime();
  for (const slot of slots) {
    if (slot.startsAt.getTime() !== cursor) return false;
    cursor = slot.endsAt.getTime();
  }
  return slots.length > 0 && cursor === to.getTime();
};

export interface RangeRules {
  now: Date;
  // Minutes before kick-off that booking closes (VenueSettings.minimumNotice).
  minimumNotice: number;
  // How far ahead slots exist (the slot horizon, in days).
  horizonDays: number;
}

// The checks that need no slots: the range itself, the minimum notice and the horizon. Run before
// locking anything, so a request that could never succeed takes no locks.
export const checkRange = (startsAt: Date, endsAt: Date, rules: RangeRules) => {
  if (endsAt <= startsAt) throw invalidRange("A booking must end after it starts.");
  const opens = rules.now.getTime() + rules.minimumNotice * 60_000;
  if (startsAt.getTime() < opens) {
    throw invalidRange("That time is too close to kick-off to book.", {
      minimumNotice: rules.minimumNotice,
    });
  }
  const horizon = rules.now.getTime() + rules.horizonDays * 24 * 60 * 60_000;
  if (endsAt.getTime() > horizon) {
    throw invalidRange(`Bookings open ${rules.horizonDays} days ahead.`, {
      horizonDays: rules.horizonDays,
    });
  }
};

// The ground's shortest and longest booking, in slots (GroundSettings).
export const checkLength = (slotCount: number, minimumSlots: number, maximumSlots: number) => {
  if (slotCount < minimumSlots || slotCount > maximumSlots) {
    throw invalidRange(`This ground is booked for ${minimumSlots} to ${maximumSlots} hours.`, {
      minimumSlots,
      maximumSlots,
    });
  }
};
