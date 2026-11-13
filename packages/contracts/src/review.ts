import { z } from "zod";
import { AdminVenue } from "./venues";

// A venue's review and going live (PR 2.7, docs/onboarding.md step 3).

export const RejectVenue = z
  .object({
    reason: z.string().trim().min(10).max(500).meta({
      description: "Shown to the owner; say what to change.",
      example: "Add photos of the pitches themselves, not only the entrance.",
    }),
  })
  .meta({ id: "RejectVenue" });

export const CheckTaxNumber = z
  .object({
    valid: z.boolean(),
    note: z.string().trim().max(300).nullable(),
  })
  .meta({ id: "CheckTaxNumber", description: "The result of checking the venue's tax number." });

export const ReviewVenue = AdminVenue.extend({
  submittedAt: z.iso.datetime().meta({ description: "When it was last sent for review." }),
}).meta({ id: "ReviewVenue" });

export const ActorKind = z.enum(["STAFF", "ADMIN", "SYSTEM"]).meta({ id: "ActorKind" });

export const VenueHistoryEvent = z
  .object({
    id: z.uuid(),
    type: z.string().meta({ example: "VENUE_SETTINGS_CHANGED" }),
    actor: z.object({
      kind: ActorKind,
      id: z.uuid().nullable(),
      name: z.string().nullable(),
    }),
    data: z
      .unknown()
      .meta({ description: "The event's details: for edits, previous and new values." }),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "VenueHistoryEvent" });

export const VenueHistoryQuery = z
  .object({
    cursor: z.uuid().optional().meta({ description: "The last id of the previous page." }),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .meta({ id: "VenueHistoryQuery" });

// Why the last review sent a draft back, shown on the owner's checklist.
export const Rejection = z
  .object({ reason: z.string(), at: z.iso.datetime() })
  .meta({ id: "Rejection" });

export type RejectVenue = z.infer<typeof RejectVenue>;
export type CheckTaxNumber = z.infer<typeof CheckTaxNumber>;
export type ReviewVenue = z.infer<typeof ReviewVenue>;
export type VenueHistoryEvent = z.infer<typeof VenueHistoryEvent>;
export type VenueHistoryQuery = z.infer<typeof VenueHistoryQuery>;
export type Rejection = z.infer<typeof Rejection>;
