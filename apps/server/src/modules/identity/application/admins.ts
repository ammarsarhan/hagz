import { prisma } from "@/platform/db/prisma";

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
