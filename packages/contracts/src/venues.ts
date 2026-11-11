import { z } from "zod";
import { StaffPermissions } from "./permissions";

const VenueRole = z.enum(["OWNER", "MEMBER"]).meta({
  id: "VenueRole",
  description: "Each venue has exactly one `OWNER`, who can do everything.",
});

// Where a venue is on its way to customers (docs/onboarding.md): an owner sets it up, submits it for
// review, an admin provisions it, then it goes live. MAINTENANCE pauses a live venue.
export const VenueStatus = z
  .enum(["DRAFT", "SUBMITTED", "PROVISIONING", "LIVE", "MAINTENANCE"])
  .meta({ id: "VenueStatus" });

// A venue as one of its staff sees it in the dashboard's venue switcher.
export const StaffVenue = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string().nullable().meta({ description: "In `Accept-Language`, else any language." }),
    status: VenueStatus,
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

// An invitation as the invitee sees it. They aren't on the staff yet, so the team is only a size and
// initials: no names, phones or ids.
export const ReceivedStaffInvitation = z
  .object({
    id: z.uuid(),
    venue: z.object({
      id: z.uuid(),
      name: z.string().nullable(),
      address: z
        .string()
        .nullable()
        .meta({ description: "Street address in `Accept-Language`, else any language." }),
      location: z.string().nullable().meta({
        description:
          "Where the venue is: its area and the place above it, in `Accept-Language`, else any language.",
        example: "Zamalek, Cairo",
      }),
      groundCount: z.int().min(0).meta({ description: "Grounds in use or under maintenance." }),
      team: z.object({
        size: z.int().min(1),
        initials: z
          .array(z.string())
          .max(2)
          .meta({ description: "Up to two members, the owner first.", example: ["OS", "MA"] }),
      }),
    }),
    invitedBy: z.string(),
    permissions: StaffPermissions.meta({ description: "What they'll be able to do there." }),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: "ReceivedStaffInvitation" });

export type InviteStaff = z.infer<typeof InviteStaff>;
export type StaffInvitation = z.infer<typeof StaffInvitation>;
export type ReceivedStaffInvitation = z.infer<typeof ReceivedStaffInvitation>;

// A row in the admin Venues table: every venue, whatever its status. Names come in both languages,
// as on the Platform page; the area is in English.
export const AdminVenue = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    names: z.object({
      en: z.string().nullable(),
      ar: z.string().nullable(),
    }),
    status: VenueStatus,
    marketplace: z.object({ id: z.uuid(), code: z.string().meta({ example: "EG" }) }),
    area: z.string().nullable().meta({ example: "Nasr City, Cairo" }),
    owner: z
      .object({
        id: z.uuid(),
        name: z.string(),
        phone: z.string().nullable().meta({ example: "+201001234567" }),
      })
      .nullable()
      .meta({ description: "Null only if the venue has no owner, which shouldn't happen." }),
    groundCount: z.int().min(0).meta({ description: "Grounds in use or under maintenance." }),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "AdminVenue" });

export const AdminVenueQuery = z.object({
  status: VenueStatus.optional(),
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .meta({ description: "Part of the name in either language, or the slug." }),
  cursor: z.uuid().optional().meta({ description: "`nextCursor` from the previous page." }),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type VenueStatus = z.infer<typeof VenueStatus>;
export type AdminVenue = z.infer<typeof AdminVenue>;
export type AdminVenueQuery = z.infer<typeof AdminVenueQuery>;
