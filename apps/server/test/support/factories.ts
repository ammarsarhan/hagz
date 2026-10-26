import type { Language } from "@/generated/prisma/enums";
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
