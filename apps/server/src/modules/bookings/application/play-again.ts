import { PLAY_AGAIN_LIMIT, type PlayAgain } from "@hagz/contracts";
import type { Language } from "@/generated/prisma/enums";
import { nameIn, placeOf } from "@/modules/venues";
import { prisma } from "@/platform/db/prisma";
import { storage } from "@/platform/storage/storage";

// Home's Play again: the live venues the player has played at (completed bookings), the latest
// first, each with the day, time and length they played most there, once they've played it twice.
// Both read on the venue's clock, so "Thursdays, 9 pm" stays 9 pm across a DST change.

const names = { translations: { select: { language: true, name: true } } } as const;

interface Played {
  venueId: string;
  played: number;
  lastPlayed: Date;
}

interface Usual {
  venueId: string;
  weekday: number;
  start: string;
  hours: number;
}

export const playAgain = async (customerId: string, language: Language): Promise<PlayAgain> => {
  const played = await prisma.$queryRaw<Played[]>`
    SELECT b."venueId", count(*)::int AS played, max(b."startsAt") AS "lastPlayed"
    FROM "Booking" b
    JOIN "VenueCustomer" vc ON vc.id = b."customerId"
    JOIN "Venue" v ON v.id = b."venueId"
    WHERE vc."customerId" = ${customerId}::uuid AND b.status = 'COMPLETED' AND v.status = 'LIVE'
    GROUP BY b."venueId"
    ORDER BY max(b."startsAt") DESC, b."venueId"
    LIMIT ${PLAY_AGAIN_LIMIT}`;
  if (played.length === 0) return { data: [] };
  const ids = played.map((row) => row.venueId);

  // Per venue, the (weekday, start, hours) played most, the latest on a tie; kept when twice or more.
  const usual = await prisma.$queryRaw<Usual[]>`
    SELECT DISTINCT ON (t."venueId") t."venueId", t.weekday, t.start, t.hours
    FROM (
      SELECT b."venueId",
             extract(dow FROM b."startsAt" AT TIME ZONE m.timezone)::int AS weekday,
             to_char(b."startsAt" AT TIME ZONE m.timezone, 'HH24:MI') AS start,
             round(extract(epoch FROM b."endsAt" - b."startsAt") / 3600)::int AS hours,
             count(*) AS n, max(b."startsAt") AS latest
      FROM "Booking" b
      JOIN "VenueCustomer" vc ON vc.id = b."customerId"
      JOIN "Venue" v ON v.id = b."venueId"
      JOIN "Marketplace" m ON m.id = v."marketplaceId"
      WHERE vc."customerId" = ${customerId}::uuid AND b.status = 'COMPLETED'
        AND b."venueId" = ANY(${ids}::uuid[])
      GROUP BY 1, 2, 3, 4
    ) t
    WHERE t.n >= 2
    ORDER BY t."venueId", t.n DESC, t.latest DESC`;
  const usualOf = new Map(usual.map((row) => [row.venueId, row]));

  const venues = await prisma.venue.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      slug: true,
      ...names,
      location: { select: { ...names, parent: { select: names } } },
      marketplace: { select: { timezone: true } },
      media: {
        where: { type: "IMAGE", status: "READY" },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        take: 1,
        select: { key: true },
      },
    },
  });
  const byId = new Map(venues.map((venue) => [venue.id, venue]));
  return {
    data: played.flatMap((row) => {
      const venue = byId.get(row.venueId);
      if (!venue) return [];
      const cover = venue.media[0];
      const often = usualOf.get(row.venueId);
      return [
        {
          venue: {
            id: venue.id,
            slug: venue.slug,
            name: nameIn(venue.translations, language),
            area: placeOf(venue.location, language),
            timezone: venue.marketplace.timezone,
            cover: cover ? { url: storage.publicUrl(cover.key) } : null,
          },
          played: row.played,
          lastPlayed: row.lastPlayed.toISOString(),
          usual: often ? { weekday: often.weekday, start: often.start, hours: often.hours } : null,
        },
      ];
    }),
  };
};
