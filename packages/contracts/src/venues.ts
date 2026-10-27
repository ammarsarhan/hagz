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
