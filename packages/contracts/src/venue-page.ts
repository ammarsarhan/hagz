import { z } from "zod";
import { GroundEnvironment, GroundSize, GroundSport, GroundSurface, PriceTier } from "./grounds";
import { Entrance, PlacedAmenity, PlacedGround } from "./layout";
import { AmenityIcon } from "./platform";
import {
  AmenityPricing,
  CancellationPolicy,
  CancellationTier,
  Loyalty,
  MinimumNotice,
  PaymentMode,
} from "./venue-edit";
import { Coordinates } from "./venue-setup";

// The venue page (PR 3.2): what anyone, signed in or not, sees of a live or paused venue, and its
// free times on a day. Not the venue's phone: players get it with a booking there (user,
// 2026-11-19), so it isn't handed to anyone who opens the page. Read by the customer app and the web's /venue/[slug]. Text follows
// `Accept-Language`, else whichever language the venue wrote it in.

const LocalDate = z.iso
  .date()
  .meta({ description: "A local date, YYYY-MM-DD.", example: "2026-11-19" });

export const PublicVenueStatus = z.enum(["LIVE", "MAINTENANCE"]).meta({
  id: "PublicVenueStatus",
  description: "`MAINTENANCE`: paused by the venue. The page shows, but nothing can be booked.",
});

export const PublicGround = z
  .object({
    id: z.uuid(),
    name: z.string().nullable(),
    sport: GroundSport,
    size: GroundSize,
    surface: GroundSurface,
    environment: GroundEnvironment,
    status: z.enum(["ACTIVE", "MAINTENANCE"]).meta({
      description: "`MAINTENANCE`: shown greyed out, with no free times.",
    }),
    priceFrom: z.int().nullable().meta({
      description:
        "The cheapest hour in its weekly hours, per hour in minor units; null until it has hours.",
    }),
    minimumSlots: z.int().min(1).meta({ description: "Shortest booking, in hours." }),
    maximumSlots: z.int().min(1).meta({ description: "Longest booking, in hours." }),
  })
  .meta({ id: "PublicGround" });

export const PublicAmenity = z
  .object({
    id: z.uuid().meta({ description: "The amenity option's id, as the layout's tiles name it." }),
    key: z.string().meta({ example: "parking" }),
    name: z.string().nullable(),
    icon: AmenityIcon,
    price: z.int().nullable().meta({ description: "Minor units; null when free." }),
    pricing: AmenityPricing.nullable(),
  })
  .meta({ id: "PublicAmenity" });

export const PublicCancellation = z
  .object({
    policy: CancellationPolicy,
    tiers: z.array(CancellationTier).meta({
      description: "Most notice first. Less notice than the last tier refunds nothing.",
    }),
    summary: z
      .array(z.string())
      .min(1)
      .meta({
        description: "The policy in plain words, a sentence a line, in `Accept-Language`.",
        example: [
          "Free cancellation up to 24 hours before it starts.",
          "50% back if you cancel 6 to 24 hours before.",
          "No refund with less than 6 hours' notice.",
          "If the venue cancels, you get everything back.",
        ],
      }),
  })
  .meta({ id: "PublicCancellation" });

export const PublicVenue = z
  .object({
    id: z.uuid(),
    slug: z.string().meta({ description: "Permanent: /venue/[slug].", example: "k7m2x9pq" }),
    status: PublicVenueStatus,
    name: z.string().nullable(),
    description: z.string().nullable(),
    marketplace: z.object({
      code: z.string().meta({ example: "EG" }),
      currency: z
        .string()
        .meta({ description: "ISO 4217; prices are in its minor units.", example: "EGP" }),
      timezone: z
        .string()
        .meta({ description: "The venue's IANA timezone.", example: "Africa/Cairo" }),
    }),
    location: z.object({
      area: z.string().nullable().meta({
        description: "Its area and the place above it.",
        example: "Maadi, Cairo",
      }),
      address: z.string().nullable(),
      coordinates: Coordinates.nullable(),
    }),
    photos: z
      .array(z.object({ id: z.uuid(), url: z.string() }))
      .meta({ description: "In the venue's order; the first is the cover." }),
    rating: z.object({
      average: z.number().min(1).max(5).nullable().meta({
        description: "Of visible reviews, to two decimals; null until the first.",
        example: 4.62,
      }),
      count: z.int().min(0),
    }),
    amenities: z.array(PublicAmenity),
    grounds: z.array(PublicGround).meta({ description: "In the venue's order." }),
    layout: z
      .object({
        columns: z.int().min(1),
        rows: z.int().min(1),
        grounds: z.array(PlacedGround),
        amenities: z.array(PlacedAmenity),
        entrances: z.array(Entrance),
      })
      .nullable()
      .meta({
        description:
          "The venue's map, about 10 m a cell; null when the venue hasn't drawn one, so the app " +
          "lists the grounds instead.",
      }),
    booking: z.object({
      instantConfirmation: z.boolean().meta({
        description: "False: the venue approves each booking.",
      }),
      minimumNotice: MinimumNotice,
      payment: z.object({
        mode: PaymentMode,
        depositPercent: z.int().nullable().meta({ description: "Set for `DEPOSIT`." }),
      }),
      cancellation: PublicCancellation.nullable().meta({
        description: "Null only for a venue that never chose one.",
      }),
      loyalty: Loyalty.nullable().meta({ description: "Null: no loyalty rewards." }),
    }),
  })
  .meta({ id: "PublicVenue" });

export const VenueAvailabilityQuery = z
  .object({
    date: LocalDate.optional().meta({
      description: "The day, in the venue's timezone. Left out: today.",
    }),
  })
  .meta({ id: "VenueAvailabilityQuery" });

export const FreeSlot = z
  .object({
    id: z.uuid(),
    groundId: z.uuid(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    tier: PriceTier,
    price: z.int().meta({ description: "In minor units." }),
  })
  .meta({ id: "FreeSlot" });

// A day of a venue's free times. Which grounds are free at a time, and for how long, follows from
// the list: a booking is back-to-back slots on one ground, each starting where the last ended.
export const VenueAvailability = z
  .object({
    date: LocalDate,
    days: z.object({ first: LocalDate, last: LocalDate }).meta({
      description: "The days that can have free times: today, to as far ahead as slots go.",
    }),
    timezone: z.string().meta({ example: "Africa/Cairo" }),
    currency: z.string().meta({ example: "EGP" }),
    slots: z.array(FreeSlot).meta({
      description:
        "Bookable now: free, on an active ground, starting after the venue's notice. Empty while " +
        "the venue is paused. By start, then ground.",
    }),
  })
  .meta({ id: "VenueAvailability" });

export type PublicVenueStatus = z.infer<typeof PublicVenueStatus>;
export type PublicGround = z.infer<typeof PublicGround>;
export type PublicAmenity = z.infer<typeof PublicAmenity>;
export type PublicCancellation = z.infer<typeof PublicCancellation>;
export type PublicVenue = z.infer<typeof PublicVenue>;
export type VenueAvailabilityQuery = z.infer<typeof VenueAvailabilityQuery>;
export type FreeSlot = z.infer<typeof FreeSlot>;
export type VenueAvailability = z.infer<typeof VenueAvailability>;
