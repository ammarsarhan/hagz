import type { AdminVenueSettings, SetCommission, UpdateVenueSettings } from "@hagz/contracts";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { VENUE_COMMISSION_CHANGED } from "../domain/events";
import { settingsView } from "../domain/settings";
import { venueNotFound } from "./access";
import { settingsSelect, storedSettings, writeSettings } from "./venue-edit";

// A venue's admin Settings tab: Hagz's commission for it, and the settings its owner also changes
// in the staff app, which admins change for support (user, 2026-11-18). Every change is recorded as
// the admin's, in any status: the owner's in-review lock is theirs, not Hagz's.

// Locks the venue row so a change can't race the owner's, and says if there's no such venue.
const lockVenue = async (tx: Tx, venueId: string) => {
  const [venue] = await tx.$queryRaw<{ commissionRate: number | null }[]>`
    SELECT "commissionRate" FROM "Venue" WHERE id = ${venueId}::uuid FOR UPDATE`;
  if (!venue) throw venueNotFound();
  return venue;
};

export const adminVenueSettings = async (venueId: string): Promise<AdminVenueSettings> => {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: {
      commissionRate: true,
      marketplace: { select: { commissionRate: true } },
      settings: { select: settingsSelect },
    },
  });
  if (!venue) throw venueNotFound();
  return {
    commission: {
      override: venue.commissionRate,
      marketplaceRate: venue.marketplace.commissionRate,
    },
    settings: settingsView(storedSettings(venue.settings)),
  };
};

export const updateSettingsAsAdmin = async (
  adminId: string,
  venueId: string,
  change: UpdateVenueSettings,
) => {
  await transaction(async (tx) => {
    await lockVenue(tx, venueId);
    await writeSettings(tx, venueId, change, { adminId });
  });
  return adminVenueSettings(venueId);
};

// Hagz's cut for this venue: a rate of its own, or null for the marketplace's.
export const setCommission = async (adminId: string, venueId: string, { rate }: SetCommission) => {
  await transaction(async (tx) => {
    const { commissionRate } = await lockVenue(tx, venueId);
    if (commissionRate === rate) return;
    await tx.venue.update({ where: { id: venueId }, data: { commissionRate: rate } });
    await tx.venueEvent.create({
      data: {
        venueId,
        adminId,
        type: VENUE_COMMISSION_CHANGED,
        data: { previous: commissionRate, next: rate },
      },
    });
  });
  return adminVenueSettings(venueId);
};
