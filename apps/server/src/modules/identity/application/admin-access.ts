import type { SuspendAccount } from "@hagz/contracts";
import type { AccountStatus } from "@/generated/prisma/enums";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { ADMIN_REACTIVATED, ADMIN_SUSPENDED } from "../domain/events";
import { accountBanned } from "./account-support";
import { adminSessions } from "./accounts";
import { cancelAdminPasswordReset } from "./admin-resets";
import { adminNotFound, ownAccount } from "./admins";
import { accountSuspended } from "./sessions";

// One admin suspending and reactivating another (the Admins page), each recorded as an AccountEvent
// on theirs.

const lastActiveAdmin = () =>
  new AppError({
    code: "LAST_ACTIVE_ADMIN",
    status: 409,
    detail: "They're the last active admin, and Hagz needs one to reactivate the rest.",
  });

// Signs them out everywhere and keeps them out until another admin reactivates them: every admin
// request checks the account (requireAdmin), so it takes effect at once, and an emailed password
// reset link stops working. Suspending again changes nothing.
//
// Hagz always keeps an active admin. The admin acting is active and isn't the one suspended, so
// that can only fail when two admins suspend each other at the same moment. Every active admin is
// locked first, so the second waits, then finds the other is the last active admin and is refused.
// An admin suspended while their request waited is refused as well, whoever they meant to suspend.
export const suspendAdmin = async (
  { adminId, by }: { adminId: string; by: string },
  { reason }: SuspendAccount,
  clock: Clock = systemClock,
) => {
  if (adminId === by) throw ownAccount();
  await transaction(async (tx) => {
    const admins = await tx.$queryRaw<{ id: string; status: AccountStatus }[]>`
      SELECT id, status FROM "Admin"
      WHERE status = 'ACTIVE' OR id = ${adminId}::uuid
      ORDER BY id
      FOR UPDATE`;
    const target = admins.find((admin) => admin.id === adminId);
    if (!target) throw adminNotFound();
    if (target.status === "BANNED") throw accountBanned();
    if (target.status === "SUSPENDED") return;
    const active = admins.filter((admin) => admin.status === "ACTIVE").map((admin) => admin.id);
    if (active.length < 2) throw lastActiveAdmin();
    if (!active.includes(by)) throw accountSuspended();

    await tx.admin.update({ where: { id: adminId }, data: { status: "SUSPENDED" } });
    await adminSessions.sessions.revoke(tx, adminId, clock.now());
    await tx.accountEvent.create({
      data: { adminId: by, subjectAdminId: adminId, type: ADMIN_SUSPENDED, data: { reason } },
    });
  });
  // Also when they were suspended already, so a retry after Redis failed here still cancels it.
  await cancelAdminPasswordReset(adminId);
};

// Lets them sign in again, afresh: their sessions stay revoked. Reactivating an active admin
// changes nothing.
export const reactivateAdmin = async ({ adminId, by }: { adminId: string; by: string }) => {
  if (adminId === by) throw ownAccount();
  await transaction(async (tx) => {
    const [admin] = await tx.$queryRaw<{ status: AccountStatus }[]>`
      SELECT status FROM "Admin" WHERE id = ${adminId}::uuid FOR UPDATE`;
    if (!admin) throw adminNotFound();
    if (admin.status === "BANNED") throw accountBanned();
    if (admin.status === "ACTIVE") return;
    await tx.admin.update({ where: { id: adminId }, data: { status: "ACTIVE" } });
    await tx.accountEvent.create({
      data: { adminId: by, subjectAdminId: adminId, type: ADMIN_REACTIVATED },
    });
  });
};
