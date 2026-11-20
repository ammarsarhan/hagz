import { z } from "zod";
import { GroundSize, GroundSport } from "./grounds";

// Search (PR 3.3, first slice): live venues found by where (an area, near a point, or a name) with
// a ground free when (a day, or a start time and length), as cards with their next free times.
// Filters beyond sport and size, the other sorts and best match come in later slices.

const LocalDate = z.iso
  .date()
  .meta({ description: "A local date, YYYY-MM-DD.", example: "2026-11-20" });

export const SEARCH_RADIUS_KM = { default: 10, max: 50 } as const;
export const SEARCH_PAGE = { default: 20, max: 50 } as const;
// The next free start times a card shows.
export const NEXT_TIMES = 4;

export const VenueSearchSort = z.enum(["DISTANCE", "RATING"]).meta({
  id: "VenueSearchSort",
  description:
    "`DISTANCE`: nearest first (needs a point). `RATING`: best rated first, unrated last. " +
    "Left out: `DISTANCE` with a point, else `RATING`.",
});

export const VenueSearchQuery = z
  .object({
    marketplace: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .meta({ description: "The marketplace's ISO 3166-1 alpha-2 code.", example: "EG" }),
    area: z.uuid().optional().meta({
      description: "A location: venues in it or anywhere under it (Cairo takes in Maadi).",
    }),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce
      .number()
      .min(0.5)
      .max(SEARCH_RADIUS_KM.max)
      .default(SEARCH_RADIUS_KM.default)
      .meta({ description: "With a point: how far to look, in km." }),
    q: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .meta({ description: "Part of the venue's name, in either language." }),
    date: LocalDate.optional().meta({ description: "In the venue's timezone. Left out: today." }),
    start: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional()
      .meta({
        description: "A start time on that date (HH:mm). Left out: any time that day.",
        example: "21:00",
      }),
    hours: z.coerce
      .number()
      .int()
      .min(1)
      .max(6)
      .default(1)
      .meta({ description: "How long the game is: a ground must be free all of it." }),
    sport: GroundSport.optional(),
    size: GroundSize.optional(),
    sort: VenueSearchSort.optional(),
    cursor: z
      .string()
      .max(200)
      .optional()
      .meta({ description: "`nextCursor` from the last page." }),
    limit: z.coerce.number().int().min(1).max(SEARCH_PAGE.max).default(SEARCH_PAGE.default),
  })
  .refine((query) => (query.latitude === undefined) === (query.longitude === undefined), {
    message: "Send latitude and longitude together.",
    path: ["latitude"],
  })
  .refine((query) => query.sort !== "DISTANCE" || query.latitude !== undefined, {
    message: "Sorting by distance needs a point.",
    path: ["sort"],
  })
  .meta({ id: "VenueSearchQuery" });

export const NextFreeTime = z
  .object({
    startsAt: z.iso.datetime(),
    grounds: z
      .int()
      .min(1)
      .meta({ description: "How many grounds are free then, for the length." }),
  })
  .meta({ id: "NextFreeTime" });

export const VenueCard = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string().nullable(),
    area: z.string().nullable().meta({ example: "Degla, Maadi" }),
    cover: z
      .object({ url: z.string() })
      .nullable()
      .meta({ description: "Its first photo; null when it has none." }),
    rating: z.object({
      average: z.number().nullable(),
      count: z.int().min(0),
    }),
    coordinates: z
      .object({ latitude: z.number(), longitude: z.number() })
      .nullable()
      .meta({ description: "Its pin, for the map; null when it has none." }),
    distance: z
      .int()
      .min(0)
      .nullable()
      .meta({ description: "Metres from the point; null without one." }),
    sports: z.array(GroundSport).meta({ description: "What its active grounds are for." }),
    priceFrom: z.int().meta({
      description: "The cheapest hour among the free times found, in minor units.",
    }),
    nextTimes: z.array(NextFreeTime).max(NEXT_TIMES).meta({
      description: "The first free start times found, earliest first.",
    }),
  })
  .meta({ id: "VenueCard" });

export const VenueSearchResults = z
  .object({
    date: LocalDate,
    timezone: z.string().meta({ example: "Africa/Cairo" }),
    currency: z.string().meta({ example: "EGP" }),
    total: z.int().min(0).nullable().meta({
      description: 'How many venues were found ("24 venues free tonight"); null on later pages.',
    }),
    data: z.array(VenueCard),
    nextCursor: z.string().nullable(),
  })
  .meta({ id: "VenueSearchResults" });

export type VenueSearchSort = z.infer<typeof VenueSearchSort>;
export type VenueSearchQuery = z.infer<typeof VenueSearchQuery>;
export type NextFreeTime = z.infer<typeof NextFreeTime>;
export type VenueCard = z.infer<typeof VenueCard>;
export type VenueSearchResults = z.infer<typeof VenueSearchResults>;
