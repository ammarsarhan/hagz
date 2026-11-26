import type { BookingSettings, UpdateBookingSettings } from "@hagz/contracts";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import type { VenueAccess } from "./access";
import { VENUE_SETTINGS_CHANGED } from "../domain/events";
import { lockForEdit } from "./venue-edit";

// The venue's day-to-day booking settings: staff holds, regulars, and Fill a slot's thresholds.
// Changes are logged with the venue's other settings changes. The bookings module serves them, and
// carries a change on to the regulars' weeks already reserved (it gets what they were before).

const KEYS = [
  "staffHoldMinutes",
  "regularHorizon",
  "confirmationWindow",
  "lapsedAfter",
  "regularBookings",
  "regularPeriod",
] as const satisfies readonly (keyof BookingSettings)[];

const select = {
  staffHoldMinutes: true,
  regularHorizon: true,
  confirmationWindow: true,
  lapsedAfter: true,
  regularBookings: true,
  regularPeriod: true,
} as const;

const noSettings = () =>
  new AppError({
    code: "VENUE_STATUS_CONFLICT",
    status: 409,
    detail: "This venue has no settings yet.",
  });

export const bookingSettings = async (actor: VenueAccess): Promise<BookingSettings> => {
  const settings = await prisma.venueSettings.findUnique({
    where: { venueId: actor.venueId },
    select,
  });
  if (!settings) throw noSettings();
  return settings;
};

export const updateBookingSettings = async (
  actor: VenueAccess,
  change: UpdateBookingSettings,
): Promise<{ previous: BookingSettings; settings: BookingSettings }> =>
  transaction(async (tx) => {
    await lockForEdit(tx, actor.venueId, "operations");
    const current = await tx.venueSettings.findUnique({
      where: { venueId: actor.venueId },
      select,
    });
    if (!current) throw noSettings();
    const changes: Record<string, { previous: number; next: number }> = {};
    for (const key of KEYS) {
      const next = change[key];
      if (next !== undefined && next !== current[key]) {
        changes[key] = { previous: current[key], next };
      }
    }
    if (Object.keys(changes).length === 0) return { previous: current, settings: current };
    const updated = await tx.venueSettings.update({
      where: { venueId: actor.venueId },
      data: change,
      select,
    });
    await tx.venueEvent.create({
      data: {
        venueId: actor.venueId,
        staffId: actor.staffId,
        type: VENUE_SETTINGS_CHANGED,
        data: { changes },
      },
    });
    return { previous: current, settings: updated };
  });
