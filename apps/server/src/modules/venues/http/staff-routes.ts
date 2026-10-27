import { createRoute, z } from "@hono/zod-openapi";
import {
  InviteStaff,
  list,
  ReceivedStaffInvitation,
  StaffInvitation,
  StaffPermissions,
  StaffVenue,
  VenueMember,
} from "@hagz/contracts";
import { requireStaff, STAFF_BEARER } from "@/platform/http/authenticate";
import { requestLanguage } from "@/platform/http/language";
import { createRouter, problemResponse } from "@/platform/http/router";
import { clientIp } from "@/platform/rate-limit/rate-limit";
import {
  acceptInvitation,
  declineInvitation,
  inviteStaff,
  listMyInvitations,
  listSentInvitations,
  previewInvitation,
  revokeInvitation,
} from "../application/invitations";
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

const invitationParams = venueParams.extend({ invitationId: z.uuid() });

const invite = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/invitations",
  tags,
  summary: "Invite someone to the staff",
  description:
    "Needs `staff: manage`. Sends a WhatsApp message with a link that opens the dashboard app; if " +
    "the number already has a staff account, the invitation also shows in their app. Works for " +
    "48 hours; inviting the same number again replaces the earlier invitation. Only the owner can " +
    "give more in an area than they have themselves.",
  middleware: [requireStaff, requireVenueAccess("staff", "manage")] as const,
  security,
  request: { params: venueParams, body: { required: true, ...json(InviteStaff) } },
  responses: {
    201: { description: "Invitation sent", ...json(StaffInvitation) },
    400: problemResponse("INVALID_PHONE_NUMBER or VALIDATION_FAILED"),
    401: unauthenticated,
    403: problemResponse("PERMISSION_DENIED, or PERMISSION_ABOVE_YOUR_OWN (with the `areas`)."),
    404: notMember,
    409: problemResponse("ALREADY_A_MEMBER"),
    429: problemResponse("RATE_LIMITED: see `retryAfter`."),
    503: problemResponse("MESSAGING_UNAVAILABLE: retry later."),
  },
});

const sentInvitations = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/invitations",
  tags,
  summary: "Invitations waiting for an answer",
  description: "Needs `staff: view`.",
  middleware: [requireStaff, requireVenueAccess("staff", "view")] as const,
  security,
  request: { params: venueParams },
  responses: {
    200: { description: "Open invitations, newest first", ...json(list(StaffInvitation)) },
    401: unauthenticated,
    403: denied,
    404: notMember,
  },
});

const revokeSent = createRoute({
  method: "delete",
  path: "/staff/venues/{venueId}/invitations/{invitationId}",
  tags,
  summary: "Withdraw an invitation",
  description: "Needs `staff: manage`. Its link stops working; withdrawing twice is fine.",
  middleware: [requireStaff, requireVenueAccess("staff", "manage")] as const,
  security,
  request: { params: invitationParams },
  responses: {
    204: { description: "Withdrawn" },
    401: unauthenticated,
    403: denied,
    404: problemResponse("VENUE_NOT_FOUND or INVITATION_NOT_FOUND"),
    409: problemResponse("INVITATION_ALREADY_ACCEPTED"),
  },
});

const invitationTags = ["Staff invitations"];
const codeParams = z.object({
  code: z
    .string()
    .min(1)
    .max(16)
    .meta({ description: "From the link; any case.", example: "K7M2QX" }),
});
const idParams = z.object({ invitationId: z.uuid() });
const answerErrors = {
  401: unauthenticated,
  403: problemResponse("ACCOUNT_SUSPENDED"),
  404: problemResponse("INVITATION_NOT_FOUND: no invitation to your number with that code or id."),
  410: problemResponse("INVITATION_EXPIRED: expired or withdrawn; ask for a new one."),
  429: problemResponse("RATE_LIMITED: see `retryAfter`."),
};

const myInvitations = createRoute({
  method: "get",
  path: "/staff/invitations",
  tags: invitationTags,
  summary: "Invitations to my number, from any venue",
  middleware: [requireStaff] as const,
  security,
  responses: {
    200: { description: "Open invitations, newest first", ...json(list(ReceivedStaffInvitation)) },
    401: unauthenticated,
    403: problemResponse("ACCOUNT_SUSPENDED"),
  },
});

const previewByCode = createRoute({
  method: "get",
  path: "/staff/invitations/code/{code}",
  tags: invitationTags,
  summary: "What an invitation link offers",
  description: "The screen the link opens. Only for the invited number.",
  middleware: [requireStaff] as const,
  security,
  request: { params: codeParams },
  responses: {
    200: { description: "The invitation", ...json(ReceivedStaffInvitation) },
    ...answerErrors,
  },
});

const acceptResponses = {
  201: { description: "Joined: the venue, with my permissions there", ...json(StaffVenue) },
  ...answerErrors,
  409: problemResponse("ALREADY_A_MEMBER"),
};

const acceptByCode = createRoute({
  method: "post",
  path: "/staff/invitations/code/{code}/accept",
  tags: invitationTags,
  summary: "Join the venue from an invitation link",
  middleware: [requireStaff] as const,
  security,
  request: { params: codeParams },
  responses: acceptResponses,
});

const acceptById = createRoute({
  method: "post",
  path: "/staff/invitations/{invitationId}/accept",
  tags: invitationTags,
  summary: "Join the venue from my invitations",
  middleware: [requireStaff] as const,
  security,
  request: { params: idParams },
  responses: acceptResponses,
});

const decline = createRoute({
  method: "post",
  path: "/staff/invitations/{invitationId}/decline",
  tags: invitationTags,
  summary: "Turn an invitation down",
  description: "Declining one that already expired or was withdrawn is fine.",
  middleware: [requireStaff] as const,
  security,
  request: { params: idParams },
  responses: {
    204: { description: "Declined" },
    401: unauthenticated,
    403: problemResponse("ACCOUNT_SUSPENDED"),
    404: problemResponse("INVITATION_NOT_FOUND"),
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
  })
  .openapi(invite, async (c) => {
    const sent = await inviteStaff(c.var.venue, c.req.valid("json"), requestLanguage(c));
    return c.json(sent, 201);
  })
  .openapi(sentInvitations, async (c) => {
    return c.json({ data: await listSentInvitations(c.var.venue.venueId) }, 200);
  })
  .openapi(revokeSent, async (c) => {
    await revokeInvitation(c.var.venue, c.req.valid("param").invitationId);
    return c.body(null, 204);
  })
  .openapi(myInvitations, async (c) => {
    const data = await listMyInvitations(c.var.staff.staffId, requestLanguage(c));
    return c.json({ data }, 200);
  })
  .openapi(previewByCode, async (c) => {
    const { code } = c.req.valid("param");
    const context = { ip: clientIp(c), language: requestLanguage(c) };
    return c.json(await previewInvitation(c.var.staff.staffId, { code }, context), 200);
  })
  .openapi(acceptByCode, async (c) => {
    const { code } = c.req.valid("param");
    const context = { ip: clientIp(c), language: requestLanguage(c) };
    return c.json(await acceptInvitation(c.var.staff.staffId, { code }, context), 201);
  })
  .openapi(acceptById, async (c) => {
    const { invitationId: id } = c.req.valid("param");
    const context = { ip: clientIp(c), language: requestLanguage(c) };
    return c.json(await acceptInvitation(c.var.staff.staffId, { id }, context), 201);
  })
  .openapi(decline, async (c) => {
    await declineInvitation(c.var.staff.staffId, c.req.valid("param").invitationId);
    return c.body(null, 204);
  });
