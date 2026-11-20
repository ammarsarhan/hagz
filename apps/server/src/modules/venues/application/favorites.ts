import type { FavoriteVenues } from "@hagz/contracts";
import type { Language } from "@/generated/prisma/enums";
import { prisma } from "@/platform/db/prisma";
import { storage } from "@/platform/storage/storage";
import { nameIn, placeOf } from "../domain/names";
import { venueNotFound } from "./access";

// Favorites (PR 3.4): a player saves venues to find them again. Saving and removing are idempotent
// (saving twice keeps the first time). Only listed venues (live or paused) can be saved; a saved
// venue that's since been taken off the list stays, marked, until the player removes it.

const listed = ["LIVE", "MAINTENANCE"] as const;

export const saveFavorite = async (customerId: string, venueId: string) => {
  const venue = await prisma.venue.findFirst({
    where: { id: venueId, status: { in: [...listed] } },
    select: { id: true },
  });
  if (!venue) throw venueNotFound();
  await prisma.venueFavorite.upsert({
    where: { customerId_venueId: { customerId, venueId } },
    create: { customerId, venueId },
    update: {},
  });
};

export const removeFavorite = async (customerId: string, venueId: string) => {
  await prisma.venueFavorite.deleteMany({ where: { customerId, venueId } });
};

const names = { translations: { select: { language: true, name: true } } } as const;

export const listFavorites = async (
  customerId: string,
  language: Language,
): Promise<FavoriteVenues> => {
  const favorites = await prisma.venueFavorite.findMany({
    where: { customerId },
    orderBy: [{ createdAt: "desc" }, { venueId: "asc" }],
    select: {
      createdAt: true,
      venue: {
        select: {
          id: true,
          slug: true,
          status: true,
          averageRating: true,
          reviewCount: true,
          ...names,
          location: { select: { ...names, parent: { select: names } } },
          media: {
            where: { type: "IMAGE", status: "READY" },
            orderBy: [{ position: "asc" }, { id: "asc" }],
            take: 1,
            select: { key: true },
          },
          grounds: { where: { status: "ACTIVE" }, select: { sport: true }, distinct: ["sport"] },
        },
      },
    },
  });
  return {
    data: favorites.map(({ createdAt, venue }) => {
      const cover = venue.media[0];
      return {
        id: venue.id,
        slug: venue.slug,
        name: nameIn(venue.translations, language),
        area: placeOf(venue.location, language),
        cover: cover ? { url: storage.publicUrl(cover.key) } : null,
        rating: {
          average: venue.averageRating === null ? null : venue.averageRating.toNumber(),
          count: venue.reviewCount,
        },
        sports: venue.grounds.map((ground) => ground.sport),
        status:
          venue.status === "LIVE" || venue.status === "MAINTENANCE" ? venue.status : "UNAVAILABLE",
        savedAt: createdAt.toISOString(),
      };
    }),
  };
};
