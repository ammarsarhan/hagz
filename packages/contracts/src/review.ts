import { z } from "zod";
import { SetupItemKey } from "./setup-items";
import { AdminVenue } from "./venues";

// A venue's review and going live (PR 2.7, docs/onboarding.md step 3).

export const RejectVenue = z
  .object({
    reason: z.string().trim().min(10).max(500).meta({
      description: "Shown to the owner; say what to change.",
      example: "Add photos of the pitches themselves, not only the entrance.",
    }),
    items: z
      .array(SetupItemKey)
      .max(SetupItemKey.options.length)
      .refine((keys) => new Set(keys).size === keys.length, { message: "Each section once." })
      .default([])
      .meta({
        description:
          "The setup sections to change. Each has to be edited before the owner can send the " +
          "venue again. Empty: the reason says it all.",
        example: ["PHOTOS"],
      }),
  })
  .meta({ id: "RejectVenue" });

// Why an admin acted on a venue's team or an account, kept with the event for audit.
export const AdminReason = z.string().trim().min(10).max(500).meta({
  description: "For the record: what happened and how it was checked.",
  example: "The owner called support: he left the business in October.",
});

export const RemoveMember = z.object({ reason: AdminReason }).meta({ id: "RemoveMember" });

export const TransferOwnership = z
  .object({
    staffId: z.uuid().meta({ description: "A member of the venue, who becomes its owner." }),
    reason: AdminReason,
  })
  .meta({ id: "TransferOwnership" });

export const BanStaff = z.object({ reason: AdminReason }).meta({ id: "BanStaff" });

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

export const GoLiveGap = z
  .enum(["AR_TRANSLATION", "EN_TRANSLATION", "ACTIVE_GROUND"])
  .meta({ id: "GoLiveGap", description: "Something a venue needs before it can go live." });

// Why the last review sent a draft back, shown on the owner's checklist.
export const Rejection = z
  .object({
    reason: z.string(),
    at: z.iso.datetime(),
    items: z.array(SetupItemKey).meta({ description: "The sections it asked to change." }),
  })
  .meta({ id: "Rejection" });

export type RejectVenue = z.infer<typeof RejectVenue>;
export type GoLiveGap = z.infer<typeof GoLiveGap>;
export type RemoveMember = z.infer<typeof RemoveMember>;
export type TransferOwnership = z.infer<typeof TransferOwnership>;
export type BanStaff = z.infer<typeof BanStaff>;
export type CheckTaxNumber = z.infer<typeof CheckTaxNumber>;
export type ReviewVenue = z.infer<typeof ReviewVenue>;
export type VenueHistoryEvent = z.infer<typeof VenueHistoryEvent>;
export type VenueHistoryQuery = z.infer<typeof VenueHistoryQuery>;
export type Rejection = z.infer<typeof Rejection>;
