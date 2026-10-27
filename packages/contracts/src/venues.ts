import { z } from "zod";
import { StaffPermissions } from "./permissions";

const VenueRole = z.enum(["OWNER", "MEMBER"]).meta({
  id: "VenueRole",
  description: "Each venue has exactly one `OWNER`, who can do everything.",
});

// A venue as one of its staff sees it in the dashboard's venue switcher.
export const StaffVenue = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string().nullable().meta({ description: "In `Accept-Language`, else any language." }),
    status: z.enum(["DRAFT", "SUBMITTED", "PROVISIONING", "LIVE", "MAINTENANCE"]),
    role: VenueRole,
    permissions: StaffPermissions.meta({
      description: "What the signed-in member may do here; all `manage` for the owner.",
    }),
  })
  .meta({ id: "StaffVenue" });

export const VenueMember = z
  .object({
    staffId: z.uuid(),
    name: z.string(),
    phone: z.string().nullable().meta({ example: "+201001234567" }),
    role: VenueRole,
    permissions: StaffPermissions,
    restorable: z.boolean().meta({
      description:
        "True when a password reset made them read-only and nothing changed since: POST " +
        "permissions/restore brings back what they had.",
    }),
  })
  .meta({ id: "VenueMember" });

export type StaffVenue = z.infer<typeof StaffVenue>;
export type VenueMember = z.infer<typeof VenueMember>;

const Phone = z.string().min(1).max(32).meta({ example: "+20 100 123 4567" });

export const InviteStaff = z
  .object({
    phone: Phone,
    permissions: StaffPermissions.optional().meta({
      description: "Defaults to the venue's default permissions for new staff.",
    }),
  })
  .meta({ id: "InviteStaff" });

// An invitation as the venue sees it.
export const StaffInvitation = z
  .object({
    id: z.uuid(),
    phone: z.string().meta({ example: "+201001234567" }),
    permissions: StaffPermissions,
    invitedBy: z.string(),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: "StaffInvitation", description: "Sent, not yet accepted, declined or revoked." });

// An invitation as the invitee sees it.
export const ReceivedStaffInvitation = z
  .object({
    id: z.uuid(),
    venue: z.object({ id: z.uuid(), name: z.string().nullable() }),
    invitedBy: z.string(),
    permissions: StaffPermissions.meta({ description: "What they'll be able to do there." }),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: "ReceivedStaffInvitation" });

export type InviteStaff = z.infer<typeof InviteStaff>;
export type StaffInvitation = z.infer<typeof StaffInvitation>;
export type ReceivedStaffInvitation = z.infer<typeof ReceivedStaffInvitation>;
