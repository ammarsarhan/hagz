import { createRoute, z } from "@hono/zod-openapi";
import {
  AdminVenue,
  AdminVenueOverview,
  AdminVenueQuery,
  BanStaff,
  CheckTaxNumber,
  Language,
  list,
  page,
  RejectVenue,
  RemoveMember,
  ReviewVenue,
  SetVenueArea,
  StaffInvitation,
  SuspendStaff,
  TransferOwnership,
  VenueHistoryEvent,
  VenueHistoryQuery,
  VenueMember,
  VenueStatus,
  VenueTranslationInput,
} from "@hagz/contracts";
import { ADMIN_COOKIE_AUTH, ADMIN_CSRF_HEADER, requireAdmin } from "@/platform/http/authenticate";
import { json, problemResponse } from "@/platform/http/definitions";

// Admin routes for the Venues page.

const tags = ["Venues (admin)"];
const security = [{ [ADMIN_COOKIE_AUTH]: [] }];
const guarded = {
  401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED: refresh, or sign in."),
  403: problemResponse(`ADMIN_HEADER_REQUIRED: send \`${ADMIN_CSRF_HEADER}: 1\`.`),
};

export const listVenues = createRoute({
  method: "get",
  path: "/admin/venues",
  tags,
  summary: "Every venue, in any status",
  description:
    "Newest first, a page at a time. `counts` has how many match the search in each status, " +
    "whatever `status` is, for the table's tabs.",
  middleware: [requireAdmin] as const,
  security,
  request: { query: AdminVenueQuery },
  responses: {
    200: {
      description: "A page of venues",
      ...json(page(AdminVenue).extend({ counts: z.record(VenueStatus, z.int().min(0)) })),
    },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED: see `errors`."),
  },
});

export const getVenue = createRoute({
  method: "get",
  path: "/admin/venues/{id}",
  tags,
  summary: "One venue, in any status",
  middleware: [requireAdmin] as const,
  security,
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: { description: "The venue", ...json(AdminVenue) },
    ...guarded,
    404: problemResponse("VENUE_NOT_FOUND"),
  },
});

const venueParams = z.object({ id: z.uuid() });
const conflict = problemResponse("VENUE_STATUS_CONFLICT (with `venueStatus`)");

export const reviewQueue = createRoute({
  method: "get",
  path: "/admin/venues/review",
  tags,
  summary: "Venues waiting for review, oldest submission first",
  middleware: [requireAdmin] as const,
  security,
  responses: {
    200: { description: "The queue", ...json(list(ReviewVenue)) },
    ...guarded,
  },
});

const step = (path: string, summary: string, description: string, extra = {}) =>
  createRoute({
    method: "post",
    path: `/admin/venues/{id}/${path}`,
    tags,
    summary,
    description,
    middleware: [requireAdmin] as const,
    security,
    request: { params: venueParams },
    responses: {
      204: { description: "Done" },
      ...guarded,
      404: problemResponse("VENUE_NOT_FOUND"),
      409: conflict,
      ...extra,
    },
  });

export const approveVenue = step(
  "approve",
  "Approve a venue in review",
  "Moves it to provisioning; the owner is told. A venue still waiting for the area its owner " +
    "asked for needs one set first.",
  { 422: problemResponse("AREA_NOT_SET (with the owner's `requestedArea`)") },
);

export const setVenueArea = createRoute({
  method: "put",
  path: "/admin/venues/{id}/area",
  tags,
  summary: "Set a venue's area",
  description:
    "Usually the one its owner asked for, once added under Locations; clears `requestedArea`. " +
    "The area must be in the venue's marketplace, and near the venue's pin.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: venueParams, body: { required: true, ...json(SetVenueArea) } },
  responses: {
    204: { description: "Set" },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("VENUE_NOT_FOUND"),
    422: problemResponse(
      "LOCATION_NOT_FOUND, LOCATION_OUTSIDE_MARKETPLACE (another marketplace's area) or " +
        "PIN_FAR_FROM_AREA (more than 15 km from the area's centre; with `areaId`, `distance` and `limit` in metres).",
    ),
  },
});

export const rejectVenue = createRoute({
  method: "post",
  path: "/admin/venues/{id}/reject",
  tags,
  summary: "Send a venue in review back to its owner",
  description: "Back to a draft, with a reason the owner sees on their checklist.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: venueParams, body: { required: true, ...json(RejectVenue) } },
  responses: {
    204: { description: "Rejected" },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("VENUE_NOT_FOUND"),
    409: conflict,
  },
});

export const provisionTranslation = createRoute({
  method: "put",
  path: "/admin/venues/{id}/translations/{language}",
  tags,
  summary: "Write the listing in one language",
  description: "Once approved: completes the language the owner didn't write.",
  middleware: [requireAdmin] as const,
  security,
  request: {
    params: venueParams.extend({ language: Language }),
    body: { required: true, ...json(VenueTranslationInput) },
  },
  responses: {
    204: { description: "Saved" },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("VENUE_NOT_FOUND"),
    409: conflict,
  },
});

export const checkTaxNumber = createRoute({
  method: "post",
  path: "/admin/venues/{id}/tax-number-check",
  tags,
  summary: "Record the result of checking the venue's tax number",
  middleware: [requireAdmin] as const,
  security,
  request: { params: venueParams, body: { required: true, ...json(CheckTaxNumber) } },
  responses: {
    204: { description: "Recorded" },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("VENUE_NOT_FOUND"),
    409: conflict,
  },
});

export const goLive = step(
  "go-live",
  "Take a provisioned venue live",
  "Needs the listing in Arabic and English (name, description, address) and an active ground. " +
    "The owner is told.",
  { 422: problemResponse("GO_LIVE_BLOCKED (with the `missing` pieces)") },
);

export const pauseVenue = step("pause", "Pause a live venue", "No new bookings until resumed.");

export const resumeVenue = step("resume", "Reopen a paused venue", "Needs an active ground.", {
  409: problemResponse("VENUE_STATUS_CONFLICT (with `venueStatus`), or NO_ACTIVE_GROUND"),
});

export const venueOverview = createRoute({
  method: "get",
  path: "/admin/venues/{id}/overview",
  tags,
  summary: "Where a venue is on its way to live",
  description:
    "The owner's checklist, when it was sent for review and why it was last sent back, what going " +
    "live still needs, and the tax number with its latest check.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: venueParams },
  responses: {
    200: { description: "The overview", ...json(AdminVenueOverview) },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("VENUE_NOT_FOUND"),
  },
});

export const venueHistory = createRoute({
  method: "get",
  path: "/admin/venues/{id}/history",
  tags,
  summary: "Everything that happened to a venue, newest first",
  middleware: [requireAdmin] as const,
  security,
  request: { params: venueParams, query: VenueHistoryQuery },
  responses: {
    200: {
      description: "A page of events",
      ...json(z.object({ data: z.array(VenueHistoryEvent), next: z.uuid().nullable() })),
    },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("VENUE_NOT_FOUND"),
  },
});

export const venueMembers = createRoute({
  method: "get",
  path: "/admin/venues/{id}/members",
  tags,
  summary: "A venue's staff",
  description: "The owner and members with their permissions, as the venue's staff see them.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: venueParams },
  responses: {
    200: { description: "Members, owner included", ...json(list(VenueMember)) },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("VENUE_NOT_FOUND"),
  },
});

export const venueInvitations = createRoute({
  method: "get",
  path: "/admin/venues/{id}/invitations",
  tags,
  summary: "A venue's open staff invitations",
  description: "Sent, not yet accepted, declined, revoked or expired; newest first.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: venueParams },
  responses: {
    200: { description: "Open invitations, newest first", ...json(list(StaffInvitation)) },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("VENUE_NOT_FOUND"),
  },
});

const memberParams = venueParams.extend({ staffId: z.uuid() });

export const removeMember = createRoute({
  method: "post",
  path: "/admin/venues/{id}/members/{staffId}/remove",
  tags,
  summary: "Take a member off a venue's staff",
  description:
    "Support, for when the venue can't (an owner who left, a lost phone). Never the owner: transfer " +
    "the venue first. Their account and their name on what they did stay; they're told.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: memberParams, body: { required: true, ...json(RemoveMember) } },
  responses: {
    204: { description: "Removed" },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("VENUE_NOT_FOUND or MEMBER_NOT_FOUND"),
    409: problemResponse("OWNER_CANT_BE_REMOVED: transfer the venue first"),
  },
});

export const revokeInvitation = createRoute({
  method: "delete",
  path: "/admin/venues/{id}/invitations/{invitationId}",
  tags,
  summary: "Revoke a venue's staff invitation",
  description: "Its code stops working. Revoking one already revoked, declined or expired is fine.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: venueParams.extend({ invitationId: z.uuid() }) },
  responses: {
    204: { description: "Revoked" },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("INVITATION_NOT_FOUND"),
    409: problemResponse("INVITATION_ALREADY_ACCEPTED: remove the member instead"),
  },
});

export const transferOwnership = createRoute({
  method: "post",
  path: "/admin/venues/{id}/owner",
  tags,
  summary: "Make another member the venue's owner",
  description:
    "Only through support, once who they are is checked: ownership controls payouts. The old owner " +
    "stays on with every permission; both are told. A venue that isn't live yet is the new owner's " +
    "one unfinished venue.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: venueParams, body: { required: true, ...json(TransferOwnership) } },
  responses: {
    204: { description: "Transferred" },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("VENUE_NOT_FOUND or MEMBER_NOT_FOUND"),
    409: problemResponse(
      "ALREADY_OWNER, STAFF_NOT_ACTIVE (with `staffStatus`), or UNFINISHED_VENUE_EXISTS (they own " +
        "another venue that isn't live; with `venueId` and `venueStatus`)",
    ),
  },
});

const staffParams = z.object({ staffId: z.uuid() });

export const suspendStaff = createRoute({
  method: "post",
  path: "/admin/staff/{staffId}/suspend",
  tags,
  summary: "Suspend a staff account",
  description:
    "Signs them out everywhere and keeps them out of every venue until reactivated. Recorded on " +
    "each venue they're on. Suspending again changes nothing.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: staffParams, body: { required: true, ...json(SuspendStaff) } },
  responses: {
    204: { description: "Suspended" },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("STAFF_NOT_FOUND"),
    409: problemResponse("ACCOUNT_BANNED: closed for good"),
  },
});

export const banStaff = createRoute({
  method: "post",
  path: "/admin/staff/{staffId}/ban",
  tags,
  summary: "Ban a staff account for good",
  description:
    "Signs them out everywhere and keeps them out for good: it can't be reactivated. Not while they " +
    "own a venue (transfer it first). Recorded on each venue they're on. Banning again changes nothing.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: staffParams, body: { required: true, ...json(BanStaff) } },
  responses: {
    204: { description: "Banned" },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("STAFF_NOT_FOUND"),
    409: problemResponse("OWNS_A_VENUE (with `venueIds`): transfer them first"),
  },
});

export const reactivateStaff = createRoute({
  method: "post",
  path: "/admin/staff/{staffId}/reactivate",
  tags,
  summary: "Reactivate a suspended staff account",
  description: "They can sign in again. Reactivating an active account changes nothing.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: staffParams },
  responses: {
    204: { description: "Reactivated" },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("STAFF_NOT_FOUND"),
    409: problemResponse("ACCOUNT_BANNED: closed for good"),
  },
});
