import type { Amenity, Location } from "@hagz/contracts";
import type { Language } from "@/generated/prisma/enums";
import { prisma } from "@/platform/db/prisma";
import { marketplaceNotFound } from "./admin-marketplaces";
import { nameIn } from "./names";

// What the apps read: an active marketplace's location tree and amenity options, named in the
// request's language. Hidden marketplaces answer like ones that don't exist.

const activeMarketplaceId = async (code: string) => {
  const marketplace = await prisma.marketplace.findFirst({
    where: { code: code.toUpperCase(), isActive: true },
    select: { id: true },
  });
  if (!marketplace) throw marketplaceNotFound();
  return marketplace.id;
};

export const listLocations = async (code: string, language: Language): Promise<Location[]> => {
  const marketplaceId = await activeMarketplaceId(code);
  const rows = await prisma.location.findMany({
    where: { marketplaceId },
    orderBy: { slug: "asc" },
    include: { translations: true },
  });
  return rows.map((l) => ({
    id: l.id,
    parentId: l.parentId,
    locality: l.locality,
    slug: l.slug,
    name: nameIn(l.translations, language),
  }));
};

export const listAmenities = async (code: string, language: Language): Promise<Amenity[]> => {
  const marketplaceId = await activeMarketplaceId(code);
  const rows = await prisma.amenityOption.findMany({
    where: { marketplaceId, isActive: true },
    orderBy: { key: "asc" },
    include: { translations: true },
  });
  return rows.map((a) => ({ id: a.id, key: a.key, name: nameIn(a.translations, language) }));
};
