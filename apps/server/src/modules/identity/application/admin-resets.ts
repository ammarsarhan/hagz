import { systemClock, type Clock } from "@/platform/clock/clock";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { adminSessions } from "./accounts";
import { adminNotFound } from "./admins";

// One admin getting another back into their account. Never on your own: you're signed in, so you
// don't need it, and a slip would sign you out of the page you're using.

const ownAccount = () =>
  new AppError({
    code: "OWN_ADMIN_ACCOUNT",
    status: 409,
    detail: "Ask another admin to do this for your account.",
  });

// Forgets their authenticator and signs them out everywhere: their next sign-in, after the
// password, sets up a new one, as on their first.
export const resetAdminAuthenticator = async (
  { adminId, by }: { adminId: string; by: string },
  clock: Clock = systemClock,
) => {
  if (adminId === by) throw ownAccount();
  await transaction(async (tx) => {
    const { count } = await tx.admin.updateMany({
      where: { id: adminId },
      data: { totpSecret: null, totpConfirmedAt: null, totpLastStep: null },
    });
    if (count === 0) throw adminNotFound();
    await adminSessions.sessions.revoke(tx, adminId, clock.now());
  });
};
