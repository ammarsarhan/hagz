import type { AdminDetails } from "@hagz/contracts";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";

// Every admin, in the order they joined, so the first one stays at the top. Suspended and banned
// admins are listed too: the list is where their access is looked after.
export const listAdmins = async () => {
  const admins = await prisma.admin.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      totpConfirmedAt: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  return admins.map((admin) => ({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    status: admin.status,
    authenticatorSetUp: admin.totpConfirmedAt !== null,
    lastSignedInAt: admin.lastLoginAt?.toISOString() ?? null,
    createdAt: admin.createdAt.toISOString(),
  }));
};

export const adminNotFound = () =>
  new AppError({ code: "ADMIN_NOT_FOUND", status: 404, detail: "No such admin." });

// One admin in full: how they joined (who invited them), what they've done with their own invites,
// and the browsers they're signed in on now. `sessionId` is the asking admin's own session, so it
// can be marked as the current one.
export const getAdmin = async (
  { id, sessionId }: { id: string; sessionId: string },
  clock: Clock = systemClock,
): Promise<AdminDetails> => {
  const admin = await prisma.admin.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      totpConfirmedAt: true,
      lastLoginAt: true,
      createdAt: true,
      invitation: { select: { invitor: { select: { name: true } } } },
      _count: { select: { invites: true } },
      sessions: {
        where: { revokedAt: null, expiresAt: { gt: clock.now() } },
        orderBy: { lastUsedAt: "desc" },
        select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastUsedAt: true },
      },
    },
  });
  if (!admin) throw adminNotFound();
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    status: admin.status,
    authenticatorSetUp: admin.totpConfirmedAt !== null,
    authenticatorSetUpAt: admin.totpConfirmedAt?.toISOString() ?? null,
    lastSignedInAt: admin.lastLoginAt?.toISOString() ?? null,
    createdAt: admin.createdAt.toISOString(),
    invitedBy: admin.invitation?.invitor.name ?? null,
    invitesSent: admin._count.invites,
    devices: admin.sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      signedInAt: session.createdAt.toISOString(),
      lastActiveAt: session.lastUsedAt.toISOString(),
      current: session.id === sessionId,
    })),
  };
};
