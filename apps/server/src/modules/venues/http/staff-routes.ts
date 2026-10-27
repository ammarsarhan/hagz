import { createRoute, z } from "@hono/zod-openapi";
import { list, StaffPermissions, StaffVenue, VenueMember } from "@hagz/contracts";
import { requireStaff, STAFF_BEARER } from "@/platform/http/authenticate";
import { requestLanguage } from "@/platform/http/language";
import { createRouter, problemResponse } from "@/platform/http/router";
import {
  listMembers,
  listMyVenues,
  changePermissions,
  restorePermissions,
} from "../application/members";
import { requireVenueAccess } from "./require-venue-access";

const json = <T>(schema: T) => ({ content: { "application/json": { schema } } });
const tags = ["Venue staff"];
const security = [{ [STAFF_BEARER]: [] }];
const unauthenticated = problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED");
const venueParams = z.object({ venueId: z.uuid() });
const memberParams = venueParams.extend({ staffId: z.uuid() });
const denied = problemResponse(
  "PERMISSION_DENIED (with `area` and `needed`), or ACCOUNT_SUSPENDED",
);
const notMember = problemResponse("VENUE_NOT_FOUND: not a venue you belong to.");

// Routes declare their middleware inline (see identity's routes): spread from a shared object, the
// route types lose `c.var`.

const myVenues = createRoute({
  method: "get",
  path: "/staff/venues",
  tags,
  summary: "The venues I belong to, with my permissions at each",
  middleware: [requireStaff] as const,
  security,
  responses: {
    200: { description: "My venues", ...json(list(StaffVenue)) },
    401: unauthenticated,
    403: problemResponse("ACCOUNT_SUSPENDED"),
  },
});

const members = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/members",
  tags,
  summary: "The venue's staff",
  description: "Needs `staff: view`.",
  middleware: [requireStaff, requireVenueAccess("staff", "view")] as const,
  security,
  request: { params: venueParams },
  responses: {
    200: { description: "Members, owner included", ...json(list(VenueMember)) },
    401: unauthenticated,
    403: denied,
    404: notMember,
  },
});

const setPermissions = createRoute({
  method: "put",
  path: "/staff/venues/{venueId}/members/{staffId}/permissions",
  tags,
  summary: "Set a member's permissions",
  description:
    "Needs `staff: manage`. Nobody can change their own permissions or the owner's, and only the " +
    "owner can give more in an area than they have themselves.",
  middleware: [requireStaff, requireVenueAccess("staff", "manage")] as const,
  security,
  request: {
    params: memberParams,
    body: { required: true, ...json(StaffPermissions) },
  },
  responses: {
    200: { description: "The new permissions", ...json(StaffPermissions) },
    401: unauthenticated,
    403: problemResponse(
      "PERMISSION_DENIED, CANNOT_CHANGE_OWN_PERMISSIONS, CANNOT_CHANGE_OWNER, or " +
        "PERMISSION_ABOVE_YOUR_OWN (with the `areas`).",
    ),
    404: problemResponse("VENUE_NOT_FOUND or MEMBER_NOT_FOUND"),
  },
});

const restore = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/members/{staffId}/permissions/restore",
  tags,
  summary: "Give back what a password reset took away",
  description:
    "Needs `staff: manage`. Works while the member is `restorable`; the same limits as setting " +
    "permissions apply.",
  middleware: [requireStaff, requireVenueAccess("staff", "manage")] as const,
  security,
  request: { params: memberParams },
  responses: {
    200: { description: "The restored permissions", ...json(StaffPermissions) },
    401: unauthenticated,
    403: problemResponse(
      "PERMISSION_DENIED, CANNOT_CHANGE_OWN_PERMISSIONS, CANNOT_CHANGE_OWNER, or " +
        "PERMISSION_ABOVE_YOUR_OWN (with the `areas`).",
    ),
    404: problemResponse("VENUE_NOT_FOUND or MEMBER_NOT_FOUND"),
    409: problemResponse("NOTHING_TO_RESTORE: their permissions changed since the reset."),
  },
});

export const venuesStaffRoutes = createRouter()
  .openapi(myVenues, async (c) => {
    const data = await listMyVenues(c.var.staff.staffId, requestLanguage(c));
    return c.json({ data }, 200);
  })
  .openapi(members, async (c) => {
    return c.json({ data: await listMembers(c.var.venue.venueId) }, 200);
  })
  .openapi(setPermissions, async (c) => {
    const { staffId } = c.req.valid("param");
    const next = await changePermissions(c.var.venue, staffId, c.req.valid("json"));
    return c.json(next, 200);
  })
  .openapi(restore, async (c) => {
    const { staffId } = c.req.valid("param");
    return c.json(await restorePermissions(c.var.venue, staffId), 200);
  });
