import { z } from "zod";

// What a venue member may do, per area of the dashboard. Owners can do everything regardless.
export const PermissionLevel = z.enum(["none", "view", "manage"]).meta({
  id: "PermissionLevel",
  description: "`none` hides the area, `view` is read-only, `manage` can also change it.",
});

const level = (description: string) => PermissionLevel.meta({ description });

export const StaffPermissions = z
  .object({
    bookings: level("The calendar; creating, editing and cancelling bookings."),
    customers: level("The venue's customers and their history."),
    schedule: level("Grounds' weekly hours, prices and blocked slots."),
    payments: level("Recording cash and issuing refunds."),
    finance: level("The ledger, payouts and earnings reports."),
    staff: level("Inviting and removing staff, and changing their permissions."),
    venue: level("Profile, layout, amenities, discounts and policies."),
  })
  .meta({ id: "StaffPermissions" });

export type PermissionLevel = z.infer<typeof PermissionLevel>;
export type StaffPermissions = z.infer<typeof StaffPermissions>;
export type PermissionArea = keyof StaffPermissions;
