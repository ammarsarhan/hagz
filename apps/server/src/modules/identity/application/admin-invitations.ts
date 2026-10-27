import type { AdminChallenge, AdminInvitation } from "@hagz/contracts";
import { z } from "zod";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { env } from "@/platform/config/env";
import { hashPassword } from "@/platform/crypto/passwords";
import { hashToken, randomToken } from "@/platform/crypto/tokens";
import { violatedUniqueIndex } from "@/platform/db/errors";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { email as mail } from "@/platform/email/email";
import { AppError } from "@/platform/errors/app-error";
import { consume } from "@/platform/rate-limit/rate-limit";
import { ADMIN_INVITATION_TTL_SECONDS, limits } from "../domain/policy";
import { challengeFor, normalizeEmail } from "./admin-sign-in";

// Admins are invite-only: an admin enters an email, the recipient follows the emailed link and picks a
// name and password, then sets up an authenticator before their first session.

const alreadyAdmin = () =>
  new AppError({ code: "ADMIN_ALREADY_EXISTS", status: 409, detail: "That email is an admin." });

// The token goes in the link's fragment, which browsers never send to a server: it stays out of
// access logs and Referer headers.
const acceptUrl = (token: string) => {
  if (!env.ADMIN_WEB_URL) {
    throw new AppError({
      code: "EMAIL_UNAVAILABLE",
      status: 503,
      detail: "Invitations can't be sent from this environment yet.",
    });
  }
  return `${env.ADMIN_WEB_URL}/admin/invitations/accept#token=${token}`;
};

export const inviteAdmin = async (
  { invitorId, email: input }: { invitorId: string; email: string },
  clock: Clock = systemClock,
): Promise<AdminInvitation> => {
  await consume(limits.adminInvitesPerAdmin, invitorId);
  const email = normalizeEmail(input);
  const token = randomToken();
  const link = acceptUrl(token);
  const now = clock.now();

  const { invitation, invitor } = await transaction(async (tx) => {
    if (await tx.admin.findUnique({ where: { email }, select: { id: true } })) throw alreadyAdmin();
    const invitor = await tx.admin.findUniqueOrThrow({
      where: { id: invitorId },
      select: { name: true },
    });
    // A new invitation replaces any open one, so only the latest link works.
    await tx.adminInvitation.updateMany({
      where: { email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    const invitation = await tx.adminInvitation.create({
      data: {
        email,
        tokenHash: hashToken(token),
        invitorId,
        expiresAt: new Date(now.getTime() + ADMIN_INVITATION_TTL_SECONDS * 1000),
      },
    });
    return { invitation, invitor };
  });

  try {
    await mail.sendAdminInvitation({
      to: email,
      invitedBy: invitor.name,
      acceptUrl: link,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    // Nothing was sent, so nothing should be left that looks sent.
    await prisma.adminInvitation.delete({ where: { id: invitation.id } }).catch(() => undefined);
    throw error;
  }
  return {
    id: invitation.id,
    email: invitation.email,
    expiresAt: invitation.expiresAt.toISOString(),
  };
};

const invitationInvalid = () =>
  new AppError({
    code: "INVITATION_INVALID",
    status: 400,
    detail: "This invitation has expired or was already used. Ask for a new one.",
  });

// Creates the admin and returns a challenge that leads straight to the authenticator setup.
export const acceptAdminInvitation = async (
  { token, name, password, ip }: { token: string; name: string; password: string; ip: string },
  clock: Clock = systemClock,
): Promise<AdminChallenge> => {
  await consume(limits.adminAcceptPerIp, ip);
  // Slow on purpose (argon2), so it happens before the transaction holds a connection.
  const passwordHash = await hashPassword(password);
  const now = clock.now();

  try {
    const admin = await transaction(async (tx) => {
      const [invitation] = await tx.$queryRaw<
        {
          id: string;
          email: string;
          expiresAt: Date;
          acceptedAt: Date | null;
          revokedAt: Date | null;
        }[]
      >`
        SELECT id, email, "expiresAt", "acceptedAt", "revokedAt" FROM "AdminInvitation"
        WHERE "tokenHash" = ${hashToken(token)}
        FOR UPDATE`;
      const usable =
        invitation?.acceptedAt === null &&
        invitation.revokedAt === null &&
        invitation.expiresAt > now;
      if (!usable) throw invitationInvalid();
      const admin = await tx.admin.create({
        data: { name, email: invitation.email, passwordHash },
      });
      await tx.adminInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: now, adminId: admin.id },
      });
      return admin;
    });
    return await challengeFor(admin, clock);
  } catch (error) {
    if (violatedUniqueIndex(error) === "Admin_email_key") throw alreadyAdmin();
    throw error;
  }
};

// Only while there are no admins at all: every later one is invited by an existing admin.
export const createFirstAdmin = async ({
  email: input,
  name,
  password,
}: {
  email: string;
  name: string;
  password: string;
}) => {
  const email = normalizeEmail(input);
  if (!z.email().safeParse(email).success) throw new Error(`Not an email address: ${email}`);
  const passwordHash = await hashPassword(password);
  return transaction(
    async (tx) => {
      if ((await tx.admin.count()) > 0) {
        throw new Error("Admins already exist: invite new ones from the admin app.");
      }
      return tx.admin.create({ data: { email, name, passwordHash }, select: { id: true } });
    },
    // Two runs at once can't both see an empty table.
    { isolationLevel: "Serializable" },
  );
};
