import { createRoute, z } from "@hono/zod-openapi";
import {
  AdminVenue,
  AdminVenueQuery,
  CheckTaxNumber,
  Language,
  list,
  page,
  RejectVenue,
  ReviewVenue,
  VenueHistoryEvent,
  VenueHistoryQuery,
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
  "Moves it to provisioning; the owner is told.",
);

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
