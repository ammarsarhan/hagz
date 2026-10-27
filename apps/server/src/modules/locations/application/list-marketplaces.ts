import type { Marketplace } from "@hagz/contracts";
import type { Language } from "@/generated/prisma/enums";
import { prisma } from "@/platform/db/prisma";

// Active marketplaces, named in `language`, falling back to English when a translation is missing.
export const listMarketplaces = async (language: Language): Promise<Marketplace[]> => {
  const marketplaces = await prisma.marketplace.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    include: { translations: { where: { language: { in: [language, "EN"] } } } },
  });

  return marketplaces.map((m) => ({
    code: m.code,
    name:
      (m.translations.find((t) => t.language === language) ?? m.translations[0])?.name ?? m.code,
    currency: m.currency,
    dialCode: m.dialCode,
    timezone: m.timezone,
  }));
};
