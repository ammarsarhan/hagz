import type { Coordinates } from "@hagz/contracts";
import type { Language } from "@/generated/prisma/enums";
import { hashPassword } from "@/platform/crypto/passwords";
import { encryptTotpSecret, generateTotpSecret } from "@/platform/crypto/totp";
import { prisma } from "@/platform/db/prisma";

let sequence = 0;
// Two letters, unique per test file: AA, AB, ...
const nextCode = () => {
  const n = sequence++;
  return String.fromCharCode(65 + (Math.floor(n / 26) % 26), 65 + (n % 26));
};

// A border for tests: a rectangle, as a GeoJSON polygon (Marketplace.boundary takes any shape).
export const box = ({
  south,
  west,
  north,
  east,
}: {
  south: number;
  west: number;
  north: number;
  east: number;
}) => ({
  type: "Polygon" as const,
  coordinates: [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ],
});

interface MarketplaceInput {
  code?: string;
  isActive?: boolean;
  names?: Partial<Record<Language, string>>;
  // Where venue pins may fall (see `box`); none by default, so no check.
  boundary?: ReturnType<typeof box>;
}

export const createMarketplace = async ({
  code = nextCode(),
  isActive = true,
  names = { EN: `Country ${code}` },
  boundary,
}: MarketplaceInput = {}) => {
  const marketplace = await prisma.marketplace.create({
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
  if (boundary) {
    await prisma.$executeRaw`
      UPDATE "Marketplace"
      SET boundary = ST_Multi(ST_GeomFromGeoJSON(${JSON.stringify(boundary)}))::geography
      WHERE id = ${marketplace.id}::uuid`;
  }
  return marketplace;
};

// Puts an area's centre somewhere (Location.center is PostGIS, which Prisma can't write).
export const setCentre = (locationId: string, { latitude, longitude }: Coordinates) =>
  prisma.$executeRaw`
    UPDATE "Location"
    SET center = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
    WHERE id = ${locationId}::uuid`;

// A published venue with the minimum it needs: a marketplace and a top-level location.
export const createVenue = async (marketplaceId: string, slug = `venue-${++sequence}`) => {
  const location = await prisma.location.create({
    data: { marketplaceId, locality: "GOVERNORATE", slug: `location-${sequence}` },
  });
  return prisma.venue.create({
    data: { marketplaceId, locationId: location.id, slug, status: "LIVE" },
  });
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

// An admin with a confirmed authenticator unless `totp` is false. Returns the TOTP secret too.
export const createAdmin = async ({
  email = "omar@hagz.app",
  password = "correct horse battery",
  totp = true,
}: { email?: string; password?: string; totp?: boolean } = {}) => {
  const secret = generateTotpSecret();
  const admin = await prisma.admin.create({
    data: {
      name: "Omar",
      email,
      passwordHash: await hashPassword(password),
      ...(totp && { totpSecret: encryptTotpSecret(secret), totpConfirmedAt: new Date() }),
    },
  });
  return { ...admin, secret };
};
