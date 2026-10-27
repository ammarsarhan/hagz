import { prisma } from "@/platform/db/prisma";

// Whether a phone calling code ("20") belongs to an active marketplace. Numbers from elsewhere are
// still accepted, but get stricter sending limits.
export const isMarketplaceCallingCode = async (callingCode: string): Promise<boolean> =>
  (await prisma.marketplace.count({ where: { isActive: true, dialCode: `+${callingCode}` } })) > 0;
