import { z } from "zod";
import { Coordinates } from "./venue-setup";
import { VenueStatus } from "./venues";

// Editing a venue (docs/onboarding.md, "Step 2"): details, translations, settings and amenities.

export const Language = z.enum(["EN", "AR"]).meta({ id: "Language" });

// How long before kick-off booking closes (VenueSettings.minimumNotice), from a fixed list so the
// picker and the player-facing copy stay simple (user, 2026-11-13). In minutes.
export const NOTICE_CHOICES = [0, 30, 60, 120, 180, 360, 720, 1440] as const;
export const MinimumNotice = z
  .union(NOTICE_CHOICES.map((minutes) => z.literal(minutes)))
  .meta({ id: "MinimumNotice", description: "Minutes before kick-off that booking closes." });

export const PaymentMode = z.enum(["MANUAL", "DEPOSIT", "PLATFORM"]).meta({
  id: "PaymentMode",
  description:
    "`MANUAL`: players pay at the venue. `DEPOSIT`: a share online, the rest at the venue. " +
    "`PLATFORM`: everything online.",
});

export const CancellationPolicy = z.enum(["FLEXIBLE", "MODERATE", "STRICT", "CUSTOM"]).meta({
  id: "CancellationPolicy",
});

// One notice tier: cancelling at least `hours` before kick-off refunds `refundPercent`. Less notice
// than the last tier refunds nothing. A venue cancelling always refunds in full.
export const CancellationTier = z
  .object({
    hours: z.int().min(1).max(336),
    refundPercent: z.int().min(0).max(100),
  })
  .meta({ id: "CancellationTier" });

export const MAXIMUM_CANCELLATION_TIERS = 5;

// Earliest notice first; each later tier needs less notice and refunds no more.
export const CancellationTiers = z
  .array(CancellationTier)
  .min(1)
  .max(MAXIMUM_CANCELLATION_TIERS)
  .refine(
    (tiers) =>
      tiers.every(
        (tier, i) =>
          i === 0 ||
          (tier.hours < tiers[i - 1]!.hours && tier.refundPercent <= tiers[i - 1]!.refundPercent),
      ),
    {
      message:
        "Tiers go from the most notice to the least, and refunds never go up as notice drops.",
    },
  )
  .meta({ id: "CancellationTiers" });

// The presets (decided 2026-11-13, from the approved designs). Bookings copy the resolved tiers.
export const CANCELLATION_PRESETS = {
  FLEXIBLE: [{ hours: 2, refundPercent: 100 }],
  MODERATE: [
    { hours: 24, refundPercent: 100 },
    { hours: 6, refundPercent: 50 },
  ],
  STRICT: [{ hours: 48, refundPercent: 50 }],
} as const satisfies Record<
  Exclude<z.infer<typeof CancellationPolicy>, "CUSTOM">,
  readonly z.infer<typeof CancellationTier>[]
>;

export const Loyalty = z
  .object({
    stamps: z.int().min(2).max(20).meta({ description: "Bookings per free one." }),
    windowDays: z.int().min(1).max(365).meta({ description: "Days the stamps last." }),
  })
  .meta({ id: "Loyalty" });

export const VenueSettingsView = z
  .object({
    autoConfirm: z.boolean(),
    minimumNotice: MinimumNotice,
    paymentMode: PaymentMode,
    depositPercent: z.int().min(1).max(99).nullable(),
    cancellationPolicy: CancellationPolicy.nullable().meta({
      description: "Null until the owner chooses one.",
    }),
    cancellationTiers: z.array(CancellationTier).nullable().meta({
      description: "The policy's tiers: the preset's, or the owner's own for `CUSTOM`.",
    }),
    loyalty: Loyalty.nullable().meta({ description: "Null: no loyalty rewards." }),
  })
  .meta({ id: "VenueSettings" });

// Only what's sent changes. The result is checked as a whole: `DEPOSIT` needs `depositPercent`,
// `CUSTOM` needs `cancellationTiers`, and neither is kept for the other modes and policies.
export const UpdateVenueSettings = z
  .object({
    autoConfirm: z.boolean(),
    minimumNotice: MinimumNotice,
    paymentMode: PaymentMode,
    depositPercent: z.int().min(1).max(99).nullable(),
    cancellationPolicy: CancellationPolicy,
    cancellationTiers: CancellationTiers.nullable(),
    loyalty: Loyalty.nullable(),
  })
  .partial()
  .meta({ id: "UpdateVenueSettings" });

export const VenueTranslationInput = z
  .object({
    name: z.string().trim().min(2).max(60),
    description: z.string().trim().max(600).nullable(),
    address: z.string().trim().max(200).nullable(),
  })
  .meta({ id: "VenueTranslationInput" });

export const VenueTranslation = VenueTranslationInput.extend({ language: Language }).meta({
  id: "VenueTranslation",
});

export const UpdateVenue = z
  .object({
    phone: z.string().trim().min(1).max(30).nullable().meta({
      description: "Shown to players. International format; landlines are fine.",
    }),
    taxNumber: z
      .string()
      .trim()
      .regex(/^[0-9-]{5,20}$/)
      .nullable()
      .meta({ description: "Set only if the venue charges VAT." }),
    location: z
      .object({
        coordinates: Coordinates,
        placeId: z.string().trim().min(1).max(300).nullable(),
        locationId: z.uuid(),
      })
      .meta({ description: "A new pin and area, in the same marketplace." }),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, { message: "Nothing to change." })
  .meta({ id: "UpdateVenue" });

export const AmenityPricing = z.enum(["PER_HOUR", "PER_BOOKING"]).meta({ id: "AmenityPricing" });

export const VenueAmenity = z
  .object({
    optionId: z.uuid(),
    price: z.int().min(1).nullable().meta({ description: "Minor units; null when free." }),
    pricing: AmenityPricing.nullable(),
  })
  .refine((amenity) => (amenity.price === null) === (amenity.pricing === null), {
    message: "A price needs its pricing, and a free amenity has neither.",
  })
  .meta({ id: "VenueAmenity" });

export const SetVenueAmenities = z
  .object({
    amenities: z
      .array(VenueAmenity)
      .max(50)
      .refine((list) => new Set(list.map((a) => a.optionId)).size === list.length, {
        message: "Each amenity once.",
      }),
  })
  .meta({ id: "SetVenueAmenities" });

// Everything the setup and edit screens show, in one read.
export const StaffVenueDetail = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    status: VenueStatus,
    phone: z.string().nullable(),
    taxNumber: z.string().nullable(),
    location: z.object({
      id: z.uuid(),
      coordinates: Coordinates.nullable(),
      placeId: z.string().nullable(),
    }),
    translations: z.array(VenueTranslation),
    settings: VenueSettingsView,
    amenities: z.array(VenueAmenity),
  })
  .meta({ id: "StaffVenueDetail" });

export type Language = z.infer<typeof Language>;
export type MinimumNotice = z.infer<typeof MinimumNotice>;
export type PaymentMode = z.infer<typeof PaymentMode>;
export type CancellationPolicy = z.infer<typeof CancellationPolicy>;
export type CancellationTier = z.infer<typeof CancellationTier>;
export type Loyalty = z.infer<typeof Loyalty>;
export type VenueSettingsView = z.infer<typeof VenueSettingsView>;
export type UpdateVenueSettings = z.infer<typeof UpdateVenueSettings>;
export type VenueTranslationInput = z.infer<typeof VenueTranslationInput>;
export type VenueTranslation = z.infer<typeof VenueTranslation>;
export type UpdateVenue = z.infer<typeof UpdateVenue>;
export type AmenityPricing = z.infer<typeof AmenityPricing>;
export type VenueAmenity = z.infer<typeof VenueAmenity>;
export type SetVenueAmenities = z.infer<typeof SetVenueAmenities>;
export type StaffVenueDetail = z.infer<typeof StaffVenueDetail>;
