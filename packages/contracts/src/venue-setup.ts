import { z } from "zod";
import { VenueStatus } from "./venues";

// Creating a venue and its setup checklist (docs/onboarding.md, steps 1 and 2).

export const Coordinates = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .meta({ id: "Coordinates", description: "A point in degrees (WGS 84)." });

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
    locationId: z.uuid().meta({
      description: "The area the owner confirmed. Its marketplace becomes the venue's.",
    }),
  })
  .meta({ id: "CreateVenue" });

// Every setup item. LAYOUT only appears for venues with two or more active grounds.
export const SetupItemKey = z
  .enum([
    "DETAILS",
    "LOCATION",
    "PHOTOS",
    "GROUNDS",
    "SCHEDULES",
    "LAYOUT",
    "SETTINGS",
    "AMENITIES",
    "TAX_NUMBER",
  ])
  .meta({ id: "SetupItemKey" });

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
  })
  .meta({ id: "SetupItem" });

export const VenueSetup = z
  .object({
    venue: z.object({
      id: z.uuid(),
      slug: z.string().meta({ description: "Permanent. Public once the venue is live." }),
      status: VenueStatus,
      name: z.string().nullable().meta({ description: "In `Accept-Language`, else any language." }),
    }),
    items: z.array(SetupItem),
    required: z
      .object({ done: z.int().min(0), total: z.int().min(0) })
      .meta({ description: "Counts of required items, for the progress ring and the draft card." }),
    canSubmit: z.boolean().meta({ description: "A draft with every required item done." }),
  })
  .meta({ id: "VenueSetup" });

export type Coordinates = z.infer<typeof Coordinates>;
export type CreateVenue = z.infer<typeof CreateVenue>;
export type SetupItemKey = z.infer<typeof SetupItemKey>;
export type SetupItemState = z.infer<typeof SetupItemState>;
export type SetupItem = z.infer<typeof SetupItem>;
export type VenueSetup = z.infer<typeof VenueSetup>;
