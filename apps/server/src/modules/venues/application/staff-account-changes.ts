import type { Tx } from "@/platform/db/transaction";
import { STAFF_BANNED, STAFF_REACTIVATED, STAFF_SUSPENDED } from "../domain/events";

// An admin's change to a staff account (identity owns the account and makes the change), recorded
// where each venue's admins look: on every venue the person is on, in identity's transaction.

const types = {
  SUSPENDED: STAFF_SUSPENDED,
  BANNED: STAFF_BANNED,
  REACTIVATED: STAFF_REACTIVATED,
} as const;

export const recordStaffAccountChange = async (
  tx: Tx,
  {
    adminId,
    staffId,
    change,
    reason,
  }: {
    adminId: string;
    staffId: string;
    change: keyof typeof types;
    // Reactivating takes none.
    reason?: string;
  },
) => {
  const memberships = await tx.venueMembership.findMany({
    where: { staffId },
    select: { venueId: true },
  });
  await tx.venueEvent.createMany({
    data: memberships.map(({ venueId }) => ({
      venueId,
      adminId,
      type: types[change],
      data: reason === undefined ? { staffId } : { staffId, reason },
    })),
  });
};

// The venues they own, read in the caller's transaction: a ban would leave each with an owner who
// can never sign in.
export const venuesOwnedBy = async (tx: Tx, staffId: string) =>
  (
    await tx.venueMembership.findMany({
      where: { staffId, role: "OWNER" },
      select: { venueId: true },
    })
  ).map(({ venueId }) => venueId);
