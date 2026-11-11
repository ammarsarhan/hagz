import { z } from "zod";

// Reference data every venue shares, managed by admins on the Platform page: marketplaces (the
// countries Hagz operates in), the location tree inside each, and each marketplace's amenity catalog.
// Admin responses carry both languages, so the admin web can show and edit them side by side.

// The kinds of place in a location tree. Countries use different words for the same level.
export const Locality = z
  .enum([
    "REGION",
    "EMIRATE",
    "GOVERNORATE",
    "MUNICIPALITY",
    "WILAYAT",
    "CITY",
    "DISTRICT",
    "AREA",
    "NEIGHBORHOOD",
  ])
  .meta({ id: "Locality" });

// A name in both languages. The English one also makes URL slugs, so it must have a letter or digit.
export const Names = z
  .object({
    en: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine((name) => /[\p{L}\p{N}]/u.test(name), "Must contain a letter or digit."),
    ar: z.string().trim().min(1).max(100),
  })
  .meta({ id: "Names", example: { en: "Nasr City", ar: "مدينة نصر" } });

const BasisPoints = z
  .int()
  .min(0)
  .max(10_000)
  .meta({ description: "Basis points: 1400 is 14%.", example: 1400 });

// --- Marketplaces ---

export const AdminMarketplace = z
  .object({
    id: z.uuid(),
    code: z.string().meta({ description: "ISO 3166-1 alpha-2.", example: "EG" }),
    names: Names,
    currency: z.string().meta({ description: "ISO 4217.", example: "EGP" }),
    dialCode: z.string().meta({ description: "E.164 prefix.", example: "+20" }),
    timezone: z.string().meta({ description: "IANA time zone.", example: "Africa/Cairo" }),
    taxRate: BasisPoints.meta({ description: "VAT in basis points (1400 is 14%)." }),
    commissionRate: BasisPoints.meta({ description: "Hagz's commission in basis points." }),
    isActive: z
      .boolean()
      .meta({ description: "Shown in the apps. New marketplaces start hidden." }),
    inUse: z.boolean().meta({
      description:
        "Has a location, venue or amenity option. Its code and currency can no longer change.",
    }),
    locationCount: z.int(),
    venueCount: z.int(),
    amenityCount: z.int(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "AdminMarketplace" });

export const CreateMarketplace = z
  .object({
    code: z
      .string()
      .regex(/^[A-Z]{2}$/, "Two capital letters (ISO 3166-1 alpha-2).")
      .meta({ example: "EG" }),
    names: Names,
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, "Three capital letters (ISO 4217).")
      .meta({ example: "EGP" }),
    dialCode: z
      .string()
      .regex(/^\+[1-9]\d{0,3}$/, "A plus and up to four digits.")
      .meta({ example: "+20" }),
    timezone: z
      .string()
      .refine((zone) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: zone });
          return zone.includes("/") || zone === "UTC";
        } catch {
          return false;
        }
      }, "An IANA time zone, e.g. Africa/Cairo.")
      .meta({ example: "Africa/Cairo" }),
    taxRate: BasisPoints,
    commissionRate: BasisPoints,
  })
  .meta({ id: "CreateMarketplace", description: "Created hidden; turn it on when it's ready." });

export const UpdateMarketplace = CreateMarketplace.partial()
  .extend({ isActive: z.boolean().optional() })
  .meta({
    id: "UpdateMarketplace",
    description: "Only the fields sent change. `code` and `currency` are refused once it's in use.",
  });

// --- Locations ---

export const AdminLocation = z
  .object({
    id: z.uuid(),
    parentId: z.uuid().nullable().meta({ description: "Null at the top of the tree." }),
    locality: Locality,
    slug: z.string().meta({
      description: "From the English name when created, then fixed: it's part of public URLs.",
      example: "nasr-city",
    }),
    names: Names,
    childCount: z.int(),
    venueCount: z.int(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "AdminLocation" });

export const CreateLocation = z
  .object({
    parentId: z.uuid().nullable().meta({ description: "Null for the top of the tree." }),
    locality: Locality,
    names: Names,
  })
  .meta({ id: "CreateLocation" });

export const UpdateLocation = z
  .object({ locality: Locality.optional(), names: Names.optional() })
  .meta({ id: "UpdateLocation", description: "The slug stays as it was." });

// --- Amenities ---

// The icons an amenity can show, by names Hagz owns. The database stores one of these, never an icon
// library's name; each app maps them to its own drawings, so renaming or swapping the library never
// touches stored data. Adding one means a line here and in each app's map, and an app release.
export const AMENITY_ICONS = [
  // Facilities
  "parking",
  "bike_parking",
  "changing_rooms",
  "showers",
  "toilets",
  "lockers",
  "prayer_room",
  "seating",
  "covered",
  "air_conditioning",
  "floodlights",
  "wifi",
  "charging",
  "screen",
  "sound",
  // Food and drink
  "cafe",
  "restaurant",
  "snacks",
  "water",
  "ice_cream",
  // Sport
  "ball_rental",
  "kit_rental",
  "scoreboard",
  "video",
  "tournaments",
  "gym",
  "pool",
  "warm_up",
  // Families
  "kids_area",
  "family",
  // Access and safety
  "accessible",
  "first_aid",
  "security",
  "cctv",
  "transport",
  // Payment
  "card_payment",
  "cash",
  "shop",
  // Anything else
  "other",
] as const;

export const AmenityIcon = z
  .enum(AMENITY_ICONS)
  .meta({
    id: "AmenityIcon",
    description: "Hagz's own icon name; each app draws it.",
    example: "parking",
  });

export const AdminAmenity = z
  .object({
    id: z.uuid(),
    key: z.string().meta({ description: "Stable code, fixed once created.", example: "parking" }),
    names: Names,
    icon: AmenityIcon,
    isActive: z.boolean().meta({ description: "Inactive options can't be newly picked." }),
    venueCount: z.int(),
  })
  .meta({ id: "AdminAmenity" });

export const CreateAmenity = z
  .object({
    key: z
      .string()
      .regex(/^[a-z][a-z0-9_]{1,39}$/, "Lowercase letters, digits and underscores.")
      .meta({ example: "parking" }),
    names: Names,
    icon: AmenityIcon,
  })
  .meta({ id: "CreateAmenity" });

export const UpdateAmenity = z
  .object({
    names: Names.optional(),
    icon: AmenityIcon.optional(),
    isActive: z.boolean().optional(),
  })
  .meta({ id: "UpdateAmenity" });

// --- Public (in the request's language) ---

export const Location = z
  .object({
    id: z.uuid(),
    parentId: z.uuid().nullable(),
    locality: Locality,
    slug: z.string(),
    name: z.string().meta({ description: "In the requested language." }),
  })
  .meta({
    id: "Location",
    description: "A place in a marketplace's tree; build the tree from `parentId`.",
  });

export const Amenity = z
  .object({
    id: z.uuid(),
    key: z.string().meta({ example: "parking" }),
    name: z.string().meta({ description: "In the requested language." }),
    icon: AmenityIcon,
  })
  .meta({ id: "Amenity" });

export type Locality = z.infer<typeof Locality>;
export type Names = z.infer<typeof Names>;
export type AdminMarketplace = z.infer<typeof AdminMarketplace>;
export type CreateMarketplace = z.infer<typeof CreateMarketplace>;
export type UpdateMarketplace = z.infer<typeof UpdateMarketplace>;
export type AdminLocation = z.infer<typeof AdminLocation>;
export type CreateLocation = z.infer<typeof CreateLocation>;
export type UpdateLocation = z.infer<typeof UpdateLocation>;
export type AmenityIcon = z.infer<typeof AmenityIcon>;
export type AdminAmenity = z.infer<typeof AdminAmenity>;
export type CreateAmenity = z.infer<typeof CreateAmenity>;
export type UpdateAmenity = z.infer<typeof UpdateAmenity>;
export type Location = z.infer<typeof Location>;
export type Amenity = z.infer<typeof Amenity>;
