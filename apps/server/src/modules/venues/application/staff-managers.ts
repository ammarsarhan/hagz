import type { Tx } from "@/platform/db/transaction";
import { managesStaff } from "../domain/permissions";

// Who hears about changes to a venue's staff: the owner and members who manage staff, except the
// member the change is about.
export const staffManagersOf = async (tx: Tx, venueId: string, except: string) => {
  const members = await tx.venueMembership.findMany({
    where: { venueId, staffId: { not: except } },
    select: { staffId: true, role: true, permissions: true },
  });
  return members
    .filter((member) => managesStaff(member.role, member.permissions))
    .map((member) => member.staffId);
};
