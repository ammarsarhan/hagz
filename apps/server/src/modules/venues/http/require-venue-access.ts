import type { PermissionArea, PermissionLevel } from "@hagz/contracts";
import { createMiddleware } from "hono/factory";
import type { StaffActor } from "@/platform/http/authenticate";
import { missingPermission, venueAccess, type VenueAccess } from "../application/access";
import { allows } from "../domain/permissions";

// The policy for every venue-scoped staff route: after requireStaff, the caller must be a member of
// the `{venueId}` in the path with at least `level` in `area`. Sets `c.var.venue`; handlers act only
// on that venue's id, never on one from the body.
export const requireVenueAccess = (area: PermissionArea, level: PermissionLevel) =>
  createMiddleware<{ Variables: { staff: StaffActor; venue: VenueAccess } }>(async (c, next) => {
    const access = await venueAccess(c.var.staff.staffId, c.req.param("venueId") ?? "");
    if (!allows(access.permissions[area], level)) throw missingPermission(area, level);
    c.set("venue", access);
    await next();
  });
