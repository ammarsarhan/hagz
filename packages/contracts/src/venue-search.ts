import { z } from "zod";
import { GroundEnvironment, GroundSize, GroundSport, GroundSurface } from "./grounds";

// Search (PR 3.3): live venues found by where (an area, near a point, or a name) with a ground free
// when (a day, or a start time and length), narrowed by the ground, the venue, how booking works and
// the price, as cards with their next free times. Best match comes in a later slice.

const LocalDate = z.iso
  .date()
  .meta({ description: "A local date, YYYY-MM-DD.", example: "2026-11-20" });

export const SEARCH_RADIUS_KM = { default: 10, max: 50 } as const;
export const SEARCH_PAGE = { default: 20, max: 50 } as const;
// The next free start times a card shows.
export const NEXT_TIMES = 4;

// A rating counts (for the RATING sort and a minimum rating) only once this many players have
// reviewed the venue: a single 5★ shouldn't outrank 200 reviews at 4.8 (user, 2026-11-20). A guess
// until there are real reviews (Phase 7); best match weighs them instead.
export const MIN_REVIEWS = 5;

export const VenueSearchSort = z
  .enum(["BEST_MATCH", "DISTANCE", "RATING", "PRICE", "SOONEST"])
  .meta({
    id: "VenueSearchSort",
    description:
      "`BEST_MATCH` (the default): the player's own venues first (a free booking ready, then " +
      "stamps being collected, then venues played at), then venues with loyalty, then the rest; " +
      "within each, by closeness, rating (pulled towards the marketplace's mean when there are " +
      "few reviews) and how many free times fit. Guests see only the last two groups. " +
      "`DISTANCE`: nearest first (needs a point). `RATING`: best rated first among venues with " +
      `at least ${MIN_REVIEWS} reviews, then those with fewer (best rated first), then the ` +
      "unrated. " +
      "`PRICE`: cheapest hour (among the free times found) first. `SOONEST`: the earliest free " +
      "start first.",
  });

// A free time is "just freed" when its slot came free again (a booking cancelled, a regular's
// reservation released) in the last day and it starts within two days (docs/regulars.md).
export const JUST_FREED = { freedWithinHours: 24, startsWithinHours: 48 } as const;

export const PaymentFilter = z.enum(["CASH", "ONLINE"]).meta({
  id: "PaymentFilter",
  description:
    "`CASH`: can be paid at the venue (cash, or a deposit and the rest there). `ONLINE`: can be " +
    "paid online (a deposit, or in full).",
});

// A comma-separated list of an enum's values, as one query parameter ("A,B").
export const listOf = (values: readonly string[], description: string) =>
  z
    .string()
    .refine((text) => text.split(",").every((part) => values.includes(part)), {
      message: `A comma-separated list of: ${values.join(", ")}.`,
    })
    .optional()
    .meta({ description, example: values.slice(0, 2).join(",") });

// "true" or "false" in a query string (z.coerce.boolean would read "false" as true).
const flag = (description: string) =>
  z
    .enum(["true", "false"])
    .optional()
    .meta({ description: `${description} \`true\` to ask for it.` });

// What narrows a search besides where and when: the ground, the venue, how booking works, the price.
// The search and its free hours take the same, so the When sheet's bars count what's searched.
export const searchFilters = {
  sport: GroundSport.optional(),
  size: GroundSize.optional(),
  surface: listOf(GroundSurface.options, "Any of these surfaces."),
  setting: listOf(GroundEnvironment.options, "Any of these: indoor, outdoor or covered."),
  grounds: z.coerce
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .meta({ description: "At least this many active grounds (of the sport, size… asked for)." }),
  priceMin: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .meta({ description: "Per hour, in minor units: a free time at least this much." }),
  priceMax: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .meta({ description: "Per hour, in minor units: a free time at most this much." }),
  amenities: z
    .string()
    .regex(/^[0-9a-f-]{36}(,[0-9a-f-]{36}){0,19}$/)
    .optional()
    .meta({ description: "Amenity option ids, comma-separated: the venue has all of them." }),
  rating: z.coerce
    .number()
    .min(1)
    .max(5)
    .optional()
    .meta({
      description: `Rated at least this, from at least ${MIN_REVIEWS} reviews (venues with fewer are left out).`,
    }),
  instant: flag("Booked without the venue approving it."),
  payment: PaymentFilter.optional(),
  flexible: flag("A full refund up to 24 hours before, or later."),
  loyalty: flag("The venue rewards regulars with free bookings."),
};

// Where and when a search looks, and its filters: the search, its spread and its count take them.
const searchQueryFields = {
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
  after: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .meta({
      description:
        "Free times from this time that day on (HH:mm), with no ground needed at exactly then " +
        "(Home's Free tonight). Ignored with `start`.",
      example: "19:00",
    }),
  hours: z.coerce
    .number()
    .int()
    .min(1)
    .max(6)
    .default(1)
    .meta({ description: "How long the game is: a ground must be free all of it." }),
  ...searchFilters,
};

// A search is for a place: an area (a governorate at the widest), near a point, or a venue's name.
// The whole country is too wide to be useful, and too slow to sort by price.
const placed = <
  T extends z.ZodType<{ area?: string; latitude?: number; longitude?: number; q?: string }>,
>(
  schema: T,
) =>
  schema
    .refine((query) => (query.latitude === undefined) === (query.longitude === undefined), {
      message: "Send latitude and longitude together.",
      path: ["latitude"],
    })
    .refine(
      (query) => query.area !== undefined || query.latitude !== undefined || query.q !== undefined,
      { message: "Search an area, near a point, or by name.", path: ["area"] },
    );

export const VenueSearchQuery = placed(
  z.object({
    ...searchQueryFields,
    sort: VenueSearchSort.optional(),
    cursor: z
      .string()
      .max(200)
      .optional()
      .meta({ description: "`nextCursor` from the last page." }),
    limit: z.coerce.number().int().min(1).max(SEARCH_PAGE.max).default(SEARCH_PAGE.default),
  }),
)
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
    justFreed: z.boolean().meta({ description: "A ground came free again then, near kick-off." }),
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
    justFreed: z.boolean().meta({
      description: "Any of its free times found came free again near kick-off.",
    }),
    loyalty: z.boolean().meta({ description: "It rewards regulars with free bookings." }),
    you: z
      .object({
        favorite: z.boolean(),
        played: z.int().min(0).meta({ description: "Bookings completed there." }),
        card: z
          .object({
            status: z.enum(["OPEN", "EARNED"]),
            stamps: z.int().min(0),
            required: z.int().min(2),
          })
          .nullable()
          .meta({
            description: 'The loyalty card being filled ("2 of 4") or with a free booking.',
          }),
      })
      .nullable()
      .meta({ description: "The signed-in player and this venue; null for guests." }),
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

// How many venues have a ground free to start each hour of a day (PR 3.3, for the When sheet's
// timeline): the search's where and what, without its when.
export const VenueFreeHoursQuery = placed(
  z.object({
    marketplace: z.string().regex(/^[A-Za-z]{2}$/),
    area: z.uuid().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().min(0.5).max(SEARCH_RADIUS_KM.max).default(SEARCH_RADIUS_KM.default),
    q: z.string().trim().min(1).max(100).optional(),
    date: LocalDate.optional().meta({ description: "In the venue's timezone. Left out: today." }),
    ...searchFilters,
  }),
).meta({ id: "VenueFreeHoursQuery" });

export const VenueFreeHours = z
  .object({
    date: LocalDate,
    timezone: z.string().meta({ example: "Africa/Cairo" }),
    hours: z
      .array(
        z.object({
          hour: z.int().min(0).max(23).meta({ description: "Local hour the game would start." }),
          venues: z.int().min(0).meta({ description: "Venues with a ground free to start then." }),
        }),
      )
      .length(24)
      .meta({
        description:
          "Every hour of the day, midnight first. Hours already past (or inside the venues' notice) count no one.",
      }),
  })
  .meta({ id: "VenueFreeHours" });

// How the venues a search finds spread over price and distance (PR 3.3, for the Filters sheet's
// price chart and Where's radius bars): the search's where, when and filters, except that the
// prices leave out the price range and the distances the radius (up to the farthest allowed).
export const PRICE_STEP = 5000;
export const VenueSpreadQuery = placed(z.object(searchQueryFields)).meta({
  id: "VenueSpreadQuery",
});

export const VenueSpread = z
  .object({
    currency: z.string().meta({ example: "EGP" }),
    prices: z
      .array(
        z.object({
          from: z.int().min(0).meta({ description: "Per hour, in minor units." }),
          venues: z.int().min(0),
        }),
      )
      .meta({
        description:
          `Venues by their cheapest hour, in bands ${PRICE_STEP} minor units wide from the ` +
          "cheapest band to the dearest, empty bands included.",
      }),
    distances: z.array(z.int().min(0)).length(SEARCH_RADIUS_KM.max).nullable().meta({
      description:
        "With a point: how many venues lie within 1 km, 2 km… up to the farthest radius allowed.",
    }),
  })
  .meta({ id: "VenueSpread" });

// Where Hagz has live venues (PR 3.3, Where's "Pick an area"): each governorate with the areas in
// it that have any, and how many each has. Venues deeper down count toward their area.
const CoveredArea = z.object({
  id: z.uuid(),
  name: z.string().nullable().meta({ description: "In the request's language." }),
  venues: z.int().min(1),
});
export const VenueCoverageQuery = z
  .object({ marketplace: z.string().regex(/^[A-Za-z]{2}$/) })
  .meta({ id: "VenueCoverageQuery" });
export const VenueCoverage = z
  .object({
    data: z
      .array(
        CoveredArea.extend({
          areas: z.array(CoveredArea).meta({ description: "Most venues first." }),
        }),
      )
      .meta({ description: "Governorates, most venues first." }),
  })
  .meta({ id: "VenueCoverage" });

// Favorites (PR 3.4): venues a player saved, most recent first.
export const FavoriteVenue = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string().nullable(),
    area: z.string().nullable(),
    cover: z.object({ url: z.string() }).nullable(),
    rating: z.object({ average: z.number().nullable(), count: z.int().min(0) }),
    sports: z.array(GroundSport),
    status: z.enum(["LIVE", "MAINTENANCE", "UNAVAILABLE"]).meta({
      description:
        "`MAINTENANCE`: paused, taking no bookings. `UNAVAILABLE`: no longer listed (kept so the " +
        "player sees it went).",
    }),
    savedAt: z.iso.datetime(),
  })
  .meta({ id: "FavoriteVenue" });
export const FavoriteVenues = z
  .object({ data: z.array(FavoriteVenue) })
  .meta({ id: "FavoriteVenues" });

export type VenueSearchSort = z.infer<typeof VenueSearchSort>;
export type VenueSearchQuery = z.infer<typeof VenueSearchQuery>;
export type NextFreeTime = z.infer<typeof NextFreeTime>;
export type VenueCard = z.infer<typeof VenueCard>;
export type VenueSearchResults = z.infer<typeof VenueSearchResults>;
export type VenueFreeHoursQuery = z.infer<typeof VenueFreeHoursQuery>;
export type VenueFreeHours = z.infer<typeof VenueFreeHours>;
export type VenueSpreadQuery = z.infer<typeof VenueSpreadQuery>;
export type VenueSpread = z.infer<typeof VenueSpread>;
export type VenueCoverageQuery = z.infer<typeof VenueCoverageQuery>;
export type VenueCoverage = z.infer<typeof VenueCoverage>;
export type FavoriteVenue = z.infer<typeof FavoriteVenue>;
export type FavoriteVenues = z.infer<typeof FavoriteVenues>;
