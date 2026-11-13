import { createRoute, z } from "@hono/zod-openapi";
import {
  CreateVenue,
  InviteStaff,
  list,
  ReceivedStaffInvitation,
  StaffInvitation,
  StaffPermissions,
  StaffVenue,
  VenueMember,
  VenueSetup,
} from "@hagz/contracts";
import { requireStaff, STAFF_BEARER } from "@/platform/http/authenticate";
import { json, problemResponse } from "@/platform/http/definitions";
import { requireVenueAccess } from "../require-venue-access";

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

export const myVenues = createRoute({
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

export const createVenue = createRoute({
  method: "post",
  path: "/staff/venues",
  tags,
  summary: "Create a venue",
  description:
    "Creates a `DRAFT` with the caller as its `OWNER` (docs/onboarding.md, step 1). The name is " +
    "stored in the caller's app language. The marketplace comes from the location, and the pin " +
    "must fall inside it. One unfinished venue (`DRAFT`, `SUBMITTED` or `PROVISIONING`) per " +
    "owner. Answers with the setup checklist.",
  middleware: [requireStaff] as const,
  security,
  request: { body: { required: true, ...json(CreateVenue) } },
  responses: {
    201: { description: "The new draft and its checklist", ...json(VenueSetup) },
    400: problemResponse("VALIDATION_FAILED"),
    401: unauthenticated,
    403: problemResponse("ACCOUNT_SUSPENDED"),
    409: problemResponse(
      "UNFINISHED_VENUE_EXISTS: the caller already owns one, given as `venueId` and `status`.",
    ),
    422: problemResponse(
      "LOCATION_NOT_FOUND (no such area, or its marketplace isn't active), or " +
        "LOCATION_OUTSIDE_MARKETPLACE (the pin is outside the area's country).",
    ),
  },
});

export const setup = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/setup",
  tags,
  summary: "The venue's setup checklist",
  description:
    "Needs `venue: view`. Computed from the venue's data on every request (docs/onboarding.md, " +
    "step 2). Items appear as their features ship.",
  middleware: [requireStaff, requireVenueAccess("venue", "view")] as const,
  security,
  request: { params: venueParams },
  responses: {
    200: { description: "The checklist", ...json(VenueSetup) },
    401: unauthenticated,
    403: denied,
    404: notMember,
  },
});

export const members = createRoute({
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

export const setPermissions = createRoute({
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

export const restore = createRoute({
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

export const invite = createRoute({
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

export const sentInvitations = createRoute({
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

export const revokeSent = createRoute({
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
// The invitee routes look the account up, so they can tell it's gone while its token still works.
const inviteeUnauthenticated = problemResponse(
  "UNAUTHENTICATED, TOKEN_EXPIRED, or SESSION_ENDED (the account is gone): sign in again.",
);
// Checked before whether the invitation is still open, so it's the answer even after it was used.
const alreadyOnTeam = problemResponse(
  "ALREADY_A_MEMBER: already on this venue's team. `venue` has its `id` and `name`.",
);

const answerErrors = {
  401: inviteeUnauthenticated,
  403: problemResponse("ACCOUNT_SUSPENDED"),
  404: problemResponse("INVITATION_NOT_FOUND: no invitation to your number with that code or id."),
  410: problemResponse("INVITATION_EXPIRED: expired or withdrawn; ask for a new one."),
  429: problemResponse("RATE_LIMITED: see `retryAfter`."),
};

export const myInvitations = createRoute({
  method: "get",
  path: "/staff/invitations",
  tags: invitationTags,
  summary: "Invitations to my number, from any venue",
  middleware: [requireStaff] as const,
  security,
  responses: {
    200: { description: "Open invitations, newest first", ...json(list(ReceivedStaffInvitation)) },
    401: inviteeUnauthenticated,
    403: problemResponse("ACCOUNT_SUSPENDED"),
  },
});

export const previewByCode = createRoute({
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
    409: alreadyOnTeam,
  },
});

const acceptResponses = {
  201: { description: "Joined: the venue, with my permissions there", ...json(StaffVenue) },
  ...answerErrors,
  409: alreadyOnTeam,
};

export const acceptByCode = createRoute({
  method: "post",
  path: "/staff/invitations/code/{code}/accept",
  tags: invitationTags,
  summary: "Join the venue from an invitation link",
  middleware: [requireStaff] as const,
  security,
  request: { params: codeParams },
  responses: acceptResponses,
});

export const acceptById = createRoute({
  method: "post",
  path: "/staff/invitations/{invitationId}/accept",
  tags: invitationTags,
  summary: "Join the venue from my invitations",
  middleware: [requireStaff] as const,
  security,
  request: { params: idParams },
  responses: acceptResponses,
});

export const decline = createRoute({
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
