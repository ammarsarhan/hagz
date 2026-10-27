import type { Language } from "@/generated/prisma/enums";
import { hashPassword } from "@/platform/crypto/passwords";
import { prisma } from "@/platform/db/prisma";

let sequence = 0;
// Two letters, unique per test file: AA, AB, ...
const nextCode = () => {
  const n = sequence++;
  return String.fromCharCode(65 + (Math.floor(n / 26) % 26), 65 + (n % 26));
};

interface MarketplaceInput {
  code?: string;
  isActive?: boolean;
  names?: Partial<Record<Language, string>>;
}

export const createMarketplace = ({
  code = nextCode(),
  isActive = true,
  names = { EN: `Country ${code}` },
}: MarketplaceInput = {}) =>
  prisma.marketplace.create({
    data: {
      code,
      currency: "EGP",
      dialCode: "+20",
      timezone: "Africa/Cairo",
      isActive,
      translations: {
        create: Object.entries(names).map(([language, name]) => ({
          language: language as Language,
          name,
        })),
      },
    },
  });

// A published venue with the minimum it needs: a marketplace and a top-level location.
export const createVenue = async (marketplaceId: string, slug = `venue-${++sequence}`) => {
  const location = await prisma.location.create({
    data: { marketplaceId, locality: "GOVERNORATE", slug: `location-${sequence}` },
  });
  return prisma.venue.create({ data: { marketplaceId, locationId: location.id, slug } });
};

export const createCustomer = async ({
  phone = "+201001234567",
  password = "correct horse battery",
  status = "ACTIVE",
  passwordHash,
  language = "AR",
  twoFactorEnabled = false,
}: {
  phone?: string;
  password?: string;
  status?: "ACTIVE" | "SUSPENDED" | "BANNED";
  passwordHash?: string;
  language?: "AR" | "EN";
  twoFactorEnabled?: boolean;
} = {}) =>
  prisma.customer.create({
    data: {
      name: "Ahmed",
      phone,
      passwordHash: passwordHash ?? (await hashPassword(password)),
      phoneVerifiedAt: new Date(),
      timezone: "Africa/Cairo",
      status,
      language,
      twoFactorEnabled,
    },
  });

export const createStaff = async ({
  phone = "+201001234567",
  password = "correct horse battery",
  language = "AR",
  twoFactorEnabled = false,
}: {
  phone?: string;
  password?: string;
  language?: "AR" | "EN";
  twoFactorEnabled?: boolean;
} = {}) =>
  prisma.staff.create({
    data: {
      name: "Mona",
      phone,
      passwordHash: await hashPassword(password),
      phoneVerifiedAt: new Date(),
      language,
      twoFactorEnabled,
    },
  });

export const addMember = (
  venueId: string,
  staffId: string,
  { role = "MEMBER", permissions = {} }: { role?: "OWNER" | "MEMBER"; permissions?: object } = {},
) => prisma.venueMembership.create({ data: { venueId, staffId, role, permissions } });
