import { z } from "zod";
import { GoLiveGap, Rejection } from "./review";
import { SetupItemKey } from "./setup-items";
import { VenueStatus } from "./venues";

// Creating a venue and its setup checklist (docs/onboarding.md, steps 1 and 2).

export const Coordinates = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .meta({ id: "Coordinates", description: "A point in degrees (WGS 84)." });

// How far a venue's pin may be from the centre of the area it's listed under, so a pin in Aswan
// can't be filed under Smouha (docs/onboarding.md, "The pin and the area"). The API turns a farther
// one away (PIN_FAR_FROM_AREA), and the app's area picker only offers areas within it.
//
// The picker suggests areas within 8 km, and a venue sits somewhere inside its area, not on the
// centre. Large districts (New Cairo, 6th of October) reach well past 8 km from their middle, so
// this allows about twice that: far enough for any venue honestly in the area, close enough to
// catch one filed in the wrong part of the country.
export const PIN_NEAR_AREA_METRES = 15_000;

// An area the owner asked for because it isn't in the list. The marketplace is the country the pin
// is in (Google's country code), since there's no area to take it from.
export const RequestedArea = z
  .object({
    name: z.string().trim().min(2).max(80).meta({ example: "Sheikh Zayed, Giza" }),
    marketplace: z
      .string()
      .length(2)
      .toUpperCase()
      .meta({ description: "ISO 3166-1 alpha-2.", example: "EG" }),
  })
  .meta({ id: "RequestedArea" });

export const CreateVenue = z
  .object({
    name: z.string().trim().min(2).max(60).meta({
      description: "In the owner's app language; the other language is added before going live.",
      example: "Champions Arena",
    }),
    coordinates: Coordinates.meta({ description: "The pin. Must fall inside the marketplace." }),
    placeId: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .optional()
      .meta({ description: "Google's place id, when the owner picked a search result." }),
    locationId: z
      .uuid()
      .optional()
      .meta({
        description:
          "The area the owner confirmed. Its marketplace becomes the venue's. " +
          "Send this or `requestedArea`, not both.",
      }),
    requestedArea: RequestedArea.optional().meta({
      description:
        "An area Hagz doesn't cover yet, in the owner's words. An admin adds it and sets it on " +
        "the venue while reviewing; the venue can't be approved before then.",
    }),
  })
  .refine((venue) => (venue.locationId === undefined) !== (venue.requestedArea === undefined), {
    message: "Send locationId or requestedArea, not both.",
    path: ["locationId"],
  })
  .meta({ id: "CreateVenue" });

// An admin setting the venue's area, usually the one its owner asked for.
export const SetVenueArea = z
  .object({ locationId: z.uuid() })
  .meta({ id: "SetVenueArea", description: "Clears the owner's requested area." });

export const SetupItemState = z.enum(["DONE", "MISSING", "BLOCKED"]).meta({
  id: "SetupItemState",
  description: "`BLOCKED`: can't be done until `blockedBy` is.",
});

export const SetupItem = z
  .object({
    key: SetupItemKey,
    required: z.boolean().meta({ description: "Needed before the venue can be sent for review." }),
    state: SetupItemState,
    blockedBy: SetupItemKey.nullable(),
    needsChanges: z.boolean().meta({
      description:
        "The last review sent the venue back asking to change this, and it hasn't been edited " +
        "since. The venue can't be sent again until it is.",
    }),
  })
  .meta({ id: "SetupItem" });

export const VenueSetup = z
  .object({
    venue: z.object({
      id: z.uuid(),
      slug: z.string().meta({ description: "Permanent. Public once the venue is live." }),
      status: VenueStatus,
      name: z.string().nullable().meta({ description: "In `Accept-Language`, else any language." }),
      submittedAt: z.iso.datetime().nullable().meta({
        description:
          "When it was last sent for review, while it's in review or approved; null otherwise.",
      }),
      approvedAt: z.iso.datetime().nullable().meta({
        description: "When an admin approved it, while it's being provisioned; null otherwise.",
      }),
    }),
    items: z.array(SetupItem),
    required: z
      .object({ done: z.int().min(0), total: z.int().min(0) })
      .meta({ description: "Counts of required items, for the progress ring and the draft card." }),
    canSubmit: z.boolean().meta({
      description: "A draft with every required item done and none that still needs changes.",
    }),
    rejection: Rejection.nullable().meta({
      description: "Why the last review sent this draft back; null otherwise.",
    }),
  })
  .meta({ id: "VenueSetup" });

export type Coordinates = z.infer<typeof Coordinates>;
export type RequestedArea = z.infer<typeof RequestedArea>;
export type CreateVenue = z.infer<typeof CreateVenue>;
export type SetVenueArea = z.infer<typeof SetVenueArea>;
export type SetupItemState = z.infer<typeof SetupItemState>;
export type SetupItem = z.infer<typeof SetupItem>;
export type VenueSetup = z.infer<typeof VenueSetup>;

// A venue's tax number with the latest check of that number. A check only counts for the number it
// was made on, so changing the number makes it unchecked again.
export const TaxNumberStatus = z
  .object({
    value: z.string().nullable(),
    check: z
      .object({ valid: z.boolean(), note: z.string().nullable(), at: z.iso.datetime() })
      .nullable()
      .meta({ description: "The latest check of this number; null when it's not been checked." }),
  })
  .meta({ id: "TaxNumberStatus" });

// Everything the admin's Application tab needs to say where a venue is on its way to live, beside the
// venue itself (GET /admin/venues/{id}).
export const AdminVenueOverview = z
  .object({
    setup: z
      .object({
        items: z.array(SetupItem),
        required: z.object({ done: z.int().min(0), total: z.int().min(0) }),
      })
      .meta({ description: "The owner's checklist, as their app shows it." }),
    submittedAt: z.iso.datetime().nullable().meta({ description: "While it's in review." }),
    rejection: Rejection.nullable().meta({
      description: "Why the last review sent this draft back, while it's a draft.",
    }),
    goLive: z
      .array(GoLiveGap)
      .meta({ description: "What's still missing to go live; empty when it's ready." }),
    taxNumber: TaxNumberStatus,
  })
  .meta({ id: "AdminVenueOverview" });

// A venue's contact and tax, for the Contact and tax section of its admin Details: the phone players
// call, and the tax number with its latest check.
export const AdminVenueContact = z
  .object({
    phone: z.string().nullable().meta({ example: "+20235514420" }),
    taxNumber: TaxNumberStatus,
  })
  .meta({ id: "AdminVenueContact" });

export type TaxNumberStatus = z.infer<typeof TaxNumberStatus>;
export type AdminVenueOverview = z.infer<typeof AdminVenueOverview>;
export type AdminVenueContact = z.infer<typeof AdminVenueContact>;
