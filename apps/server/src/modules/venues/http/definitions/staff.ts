import { createRoute, z } from "@hono/zod-openapi";
import {
  VenueLayout,
  VenueLayoutView,
  CopySchedule,
  CreateGround,
  Ground,
  ReorderGrounds,
  UpdateGround,
  WeekSchedule,
  CreateVenue,
  PhotoUpload,
  ReorderPhotos,
  RequestPhotoUpload,
  VenuePhoto,
  Language,
  SetVenueAmenities,
  StaffVenueDetail,
  UpdateVenue,
  UpdateVenueSettings,
  VenueTranslationInput,
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
      "UNFINISHED_VENUE_EXISTS: the caller already owns one, given as `venueId` and `venueStatus`.",
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

const locked = problemResponse(
  "VENUE_STATUS_CONFLICT (with `venueStatus`): in review nothing can change; while Hagz " +
    "provisions the venue, the listing (name, description, address, location, photos) can't.",
);

export const venueDetail = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}",
  tags,
  summary: "Everything the setup and edit screens show",
  description: "Needs `venue: view`.",
  middleware: [requireStaff, requireVenueAccess("venue", "view")] as const,
  security,
  request: { params: venueParams },
  responses: {
    200: { description: "The venue", ...json(StaffVenueDetail) },
    401: unauthenticated,
    403: denied,
    404: notMember,
  },
});

export const updateVenue = createRoute({
  method: "patch",
  path: "/staff/venues/{venueId}",
  tags,
  summary: "Change the phone, tax number or location",
  description:
    "Needs `venue: manage`. Only what's sent changes. A new area must be in the venue's " +
    "marketplace, with the pin inside it.",
  middleware: [requireStaff, requireVenueAccess("venue", "manage")] as const,
  security,
  request: { params: venueParams, body: { required: true, ...json(UpdateVenue) } },
  responses: {
    200: { description: "The venue after the change", ...json(StaffVenueDetail) },
    400: problemResponse("INVALID_PHONE_NUMBER or VALIDATION_FAILED"),
    401: unauthenticated,
    403: denied,
    404: notMember,
    409: locked,
    422: problemResponse("LOCATION_NOT_FOUND or LOCATION_OUTSIDE_MARKETPLACE"),
  },
});

export const putTranslation = createRoute({
  method: "put",
  path: "/staff/venues/{venueId}/translations/{language}",
  tags,
  summary: "Set the name, description and address in one language",
  description:
    "Needs `venue: manage`. The app writes the owner's language; Hagz adds the other one " +
    "before the venue goes live.",
  middleware: [requireStaff, requireVenueAccess("venue", "manage")] as const,
  security,
  request: {
    params: venueParams.extend({ language: Language }),
    body: { required: true, ...json(VenueTranslationInput) },
  },
  responses: {
    200: { description: "The venue after the change", ...json(StaffVenueDetail) },
    400: problemResponse("VALIDATION_FAILED"),
    401: unauthenticated,
    403: denied,
    404: notMember,
    409: locked,
  },
});

export const updateSettings = createRoute({
  method: "patch",
  path: "/staff/venues/{venueId}/settings",
  tags,
  summary: "Change how bookings are confirmed, paid for and refunded",
  description:
    "Needs `venue: manage`. Only what's sent changes; the result is checked as a whole. " +
    "`DEPOSIT` needs `depositPercent` and `CUSTOM` needs `cancellationTiers`; switching away " +
    "clears them.",
  middleware: [requireStaff, requireVenueAccess("venue", "manage")] as const,
  security,
  request: { params: venueParams, body: { required: true, ...json(UpdateVenueSettings) } },
  responses: {
    200: { description: "The venue after the change", ...json(StaffVenueDetail) },
    400: problemResponse("VALIDATION_FAILED"),
    401: unauthenticated,
    403: denied,
    404: notMember,
    409: locked,
    422: problemResponse("INVALID_SETTINGS (with the `field`)"),
  },
});

export const setAmenities = createRoute({
  method: "put",
  path: "/staff/venues/{venueId}/amenities",
  tags,
  summary: "Set which amenities the venue has, and their prices",
  description:
    "Needs `venue: manage`. Replaces the whole set. Options come from the venue's marketplace; " +
    "a retired one can be kept but not newly picked.",
  middleware: [requireStaff, requireVenueAccess("venue", "manage")] as const,
  security,
  request: { params: venueParams, body: { required: true, ...json(SetVenueAmenities) } },
  responses: {
    200: { description: "The venue after the change", ...json(StaffVenueDetail) },
    400: problemResponse("VALIDATION_FAILED"),
    401: unauthenticated,
    403: denied,
    404: notMember,
    409: locked,
    422: problemResponse("AMENITY_NOT_AVAILABLE (with the `optionIds`)"),
  },
});

const photoParams = venueParams.extend({ photoId: z.uuid() });

export const photos = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/photos",
  tags,
  summary: "The venue's photos, in order",
  description: "Needs `venue: view`. Includes uploads not confirmed yet (`PENDING`).",
  middleware: [requireStaff, requireVenueAccess("venue", "view")] as const,
  security,
  request: { params: venueParams },
  responses: {
    200: { description: "Photos, the cover first", ...json(list(VenuePhoto)) },
    401: unauthenticated,
    403: denied,
    404: notMember,
  },
});

export const requestPhotoUpload = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/photos",
  tags,
  summary: "Start uploading a photo",
  description:
    "Needs `venue: manage`. Answers with a signed request to send the file to (valid 15 " +
    "minutes); upload it, then confirm. The app resizes photos before uploading.",
  middleware: [requireStaff, requireVenueAccess("venue", "manage")] as const,
  security,
  request: { params: venueParams, body: { required: true, ...json(RequestPhotoUpload) } },
  responses: {
    201: { description: "Where to upload", ...json(PhotoUpload) },
    400: problemResponse("VALIDATION_FAILED: only JPEG, PNG or WebP, up to 10 MB."),
    401: unauthenticated,
    403: denied,
    404: notMember,
    409: problemResponse("PHOTO_LIMIT_REACHED, or VENUE_STATUS_CONFLICT (with `venueStatus`)"),
    503: problemResponse("STORAGE_UNAVAILABLE"),
  },
});

export const confirmPhoto = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/photos/{photoId}/confirm",
  tags,
  summary: "Confirm an upload, putting the photo on the venue",
  description:
    "Needs `venue: manage`. Checks the stored file is the type and size that were declared.",
  middleware: [requireStaff, requireVenueAccess("venue", "manage")] as const,
  security,
  request: { params: photoParams },
  responses: {
    200: { description: "The photo, now ready", ...json(VenuePhoto) },
    401: unauthenticated,
    403: denied,
    404: problemResponse("VENUE_NOT_FOUND or PHOTO_NOT_FOUND"),
    409: problemResponse("UPLOAD_NOT_FOUND, or VENUE_STATUS_CONFLICT (with `venueStatus`)"),
    422: problemResponse("UPLOAD_MISMATCH: ask for a new upload."),
  },
});

export const reorderPhotos = createRoute({
  method: "put",
  path: "/staff/venues/{venueId}/photos/order",
  tags,
  summary: "Reorder the photos; the first is the cover",
  description: "Needs `venue: manage`. Lists every ready photo exactly once.",
  middleware: [requireStaff, requireVenueAccess("venue", "manage")] as const,
  security,
  request: { params: venueParams, body: { required: true, ...json(ReorderPhotos) } },
  responses: {
    200: { description: "Photos in the new order", ...json(list(VenuePhoto)) },
    400: problemResponse("VALIDATION_FAILED"),
    401: unauthenticated,
    403: denied,
    404: notMember,
    409: locked,
    422: problemResponse("INVALID_PHOTO_ORDER"),
  },
});

export const removePhoto = createRoute({
  method: "delete",
  path: "/staff/venues/{venueId}/photos/{photoId}",
  tags,
  summary: "Remove a photo",
  description: "Needs `venue: manage`.",
  middleware: [requireStaff, requireVenueAccess("venue", "manage")] as const,
  security,
  request: { params: photoParams },
  responses: {
    204: { description: "Removed" },
    401: unauthenticated,
    403: denied,
    404: problemResponse("VENUE_NOT_FOUND or PHOTO_NOT_FOUND"),
    409: locked,
  },
});

const groundParams = venueParams.extend({ groundId: z.uuid() });
const groundGone = problemResponse("VENUE_NOT_FOUND or GROUND_NOT_FOUND");

export const grounds = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/grounds",
  tags,
  summary: "The venue's grounds, in order",
  description: "Needs `venue: view`. Deleted grounds are left out.",
  middleware: [requireStaff, requireVenueAccess("venue", "view")] as const,
  security,
  request: { params: venueParams },
  responses: {
    200: { description: "Grounds", ...json(list(Ground)) },
    401: unauthenticated,
    403: denied,
    404: notMember,
  },
});

export const createGround = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/grounds",
  tags,
  summary: "Add a ground",
  description:
    "Needs `schedule: manage`. The name is stored in the caller's app language. Football comes " +
    "in 5, 7 and 11-a-side; other sports are `STANDARD`.",
  middleware: [requireStaff, requireVenueAccess("schedule", "manage")] as const,
  security,
  request: { params: venueParams, body: { required: true, ...json(CreateGround) } },
  responses: {
    201: { description: "The new ground", ...json(Ground) },
    400: problemResponse("VALIDATION_FAILED"),
    401: unauthenticated,
    403: denied,
    404: notMember,
    409: problemResponse("GROUND_LIMIT_REACHED, or VENUE_STATUS_CONFLICT (with `venueStatus`)"),
  },
});

export const updateGround = createRoute({
  method: "patch",
  path: "/staff/venues/{venueId}/grounds/{groundId}",
  tags,
  summary: "Change a ground, or pause or resume it",
  description:
    "Needs `schedule: manage`. Only what's sent changes; the result is checked as a whole. A new " +
    "sport or size takes the ground off the layout if it no longer fits there.",
  middleware: [requireStaff, requireVenueAccess("schedule", "manage")] as const,
  security,
  request: { params: groundParams, body: { required: true, ...json(UpdateGround) } },
  responses: {
    200: { description: "The ground after the change", ...json(Ground) },
    400: problemResponse("VALIDATION_FAILED"),
    401: unauthenticated,
    403: denied,
    404: groundGone,
    409: problemResponse("LAST_ACTIVE_GROUND, or VENUE_STATUS_CONFLICT (with `venueStatus`)"),
    422: problemResponse("INVALID_GROUND (with the `field`)"),
  },
});

export const removeGround = createRoute({
  method: "delete",
  path: "/staff/venues/{venueId}/grounds/{groundId}",
  tags,
  summary: "Remove a ground",
  description:
    "Needs `schedule: manage`. Kept for booking history, gone from the venue and its layout.",
  middleware: [requireStaff, requireVenueAccess("schedule", "manage")] as const,
  security,
  request: { params: groundParams },
  responses: {
    204: { description: "Removed" },
    401: unauthenticated,
    403: denied,
    404: groundGone,
    409: problemResponse("LAST_ACTIVE_GROUND, or VENUE_STATUS_CONFLICT (with `venueStatus`)"),
  },
});

export const reorderGrounds = createRoute({
  method: "put",
  path: "/staff/venues/{venueId}/grounds/order",
  tags,
  summary: "Reorder the grounds",
  description: "Needs `schedule: manage`. Lists every ground exactly once.",
  middleware: [requireStaff, requireVenueAccess("schedule", "manage")] as const,
  security,
  request: { params: venueParams, body: { required: true, ...json(ReorderGrounds) } },
  responses: {
    200: { description: "Grounds in the new order", ...json(list(Ground)) },
    400: problemResponse("VALIDATION_FAILED"),
    401: unauthenticated,
    403: denied,
    404: notMember,
    409: locked,
    422: problemResponse("INVALID_GROUND_ORDER"),
  },
});

export const groundSchedule = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/grounds/{groundId}/schedule",
  tags,
  summary: "A ground's weekly hours",
  description: "Needs `schedule: view`. Days left out are closed.",
  middleware: [requireStaff, requireVenueAccess("schedule", "view")] as const,
  security,
  request: { params: groundParams },
  responses: {
    200: { description: "The week", ...json(WeekSchedule) },
    401: unauthenticated,
    403: denied,
    404: groundGone,
  },
});

export const putSchedule = createRoute({
  method: "put",
  path: "/staff/venues/{venueId}/grounds/{groundId}/schedule",
  tags,
  summary: "Set a ground's weekly hours",
  description:
    "Needs `schedule: manage`. Replaces the week. Each open hour is `BASE`, `PEAK` or `DISCOUNT`; " +
    "the last two need the ground to have that price. Hours past midnight belong in the next day.",
  middleware: [requireStaff, requireVenueAccess("schedule", "manage")] as const,
  security,
  request: { params: groundParams, body: { required: true, ...json(WeekSchedule) } },
  responses: {
    200: { description: "The week after the change", ...json(WeekSchedule) },
    400: problemResponse("VALIDATION_FAILED"),
    401: unauthenticated,
    403: denied,
    404: groundGone,
    409: locked,
    422: problemResponse("SCHEDULE_TIER_WITHOUT_PRICE (with the `tier`)"),
  },
});

export const copySchedule = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/grounds/{groundId}/schedule/copy",
  tags,
  summary: "Copy a ground's weekly hours to others",
  description:
    "Needs `schedule: manage`. The hours and their tiers are copied; each ground keeps its own " +
    "prices, so each must have the prices the copied tiers need.",
  middleware: [requireStaff, requireVenueAccess("schedule", "manage")] as const,
  security,
  request: { params: groundParams, body: { required: true, ...json(CopySchedule) } },
  responses: {
    204: { description: "Copied" },
    400: problemResponse("VALIDATION_FAILED"),
    401: unauthenticated,
    403: denied,
    404: groundGone,
    409: locked,
    422: problemResponse("SCHEDULE_TIER_WITHOUT_PRICE (with the `tier` and the `groundId`)"),
  },
});

export const layout = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/layout",
  tags,
  summary: "The venue layout",
  description:
    "Needs `venue: view`. Before the first save, a suggested empty grid (`saved: false`). " +
    "`unplacedGroundIds` are the grounds still to place.",
  middleware: [requireStaff, requireVenueAccess("venue", "view")] as const,
  security,
  request: { params: venueParams },
  responses: {
    200: { description: "The layout", ...json(VenueLayoutView) },
    401: unauthenticated,
    403: denied,
    404: notMember,
  },
});

export const saveLayout = createRoute({
  method: "put",
  path: "/staff/venues/{venueId}/layout",
  tags,
  summary: "Save the whole venue layout",
  description:
    "Needs `venue: manage`. Replaces the layout in one go. Ground footprints come from their " +
    "sport and size; everything must be inside the grid without overlapping, and entrances on " +
    "their side.",
  middleware: [requireStaff, requireVenueAccess("venue", "manage")] as const,
  security,
  request: { params: venueParams, body: { required: true, ...json(VenueLayout) } },
  responses: {
    200: { description: "The layout after saving", ...json(VenueLayoutView) },
    400: problemResponse("VALIDATION_FAILED"),
    401: unauthenticated,
    403: denied,
    404: notMember,
    409: locked,
    422: problemResponse(
      "INVALID_LAYOUT, with a `reason`: OUT_OF_BOUNDS, OVERLAP (with the `items`), " +
        "UNKNOWN_GROUND or DUPLICATE_GROUND (with the `groundId`), ENTRANCE_OUT_OF_RANGE or " +
        "DUPLICATE_ENTRANCE.",
    ),
  },
});

const lifecycle = (path: string, summary: string, description: string, conflict: string) =>
  createRoute({
    method: "post",
    path: `/staff/venues/{venueId}/${path}`,
    tags,
    summary,
    description,
    middleware: [requireStaff, requireVenueAccess("venue", "manage")] as const,
    security,
    request: { params: venueParams },
    responses: {
      200: { description: "The venue's setup after the change", ...json(VenueSetup) },
      401: unauthenticated,
      403: problemResponse("PERMISSION_DENIED, OWNER_ONLY or ACCOUNT_SUSPENDED"),
      404: notMember,
      409: problemResponse(conflict),
      422: problemResponse("SETUP_INCOMPLETE (with the `missing` item keys)"),
    },
  });

export const submitVenue = lifecycle(
  "submit",
  "Send the venue for review",
  "Owner only. Every required setup item must be done. Locks the venue until an admin decides " +
    "or the owner withdraws it.",
  "VENUE_STATUS_CONFLICT: only a draft can be sent (with `venueStatus`).",
);

export const withdrawVenue = lifecycle(
  "withdraw",
  "Take the venue out of review, back to a draft",
  "Owner only.",
  "VENUE_STATUS_CONFLICT: only a venue in review (with `venueStatus`).",
);

const pauseOrResume = (path: "pause" | "resume", summary: string, description: string) =>
  createRoute({
    method: "post",
    path: `/staff/venues/{venueId}/${path}`,
    tags,
    summary,
    description,
    middleware: [requireStaff, requireVenueAccess("venue", "manage")] as const,
    security,
    request: { params: venueParams },
    responses: {
      204: { description: "Done" },
      401: unauthenticated,
      403: denied,
      404: notMember,
      409: problemResponse("VENUE_STATUS_CONFLICT (with `venueStatus`), or NO_ACTIVE_GROUND"),
    },
  });

export const pauseVenue = pauseOrResume(
  "pause",
  "Pause a live venue",
  "Needs `venue: manage`. Its page stays up with a notice; no new bookings, existing ones stand.",
);

export const resumeVenue = pauseOrResume(
  "resume",
  "Reopen a paused venue",
  "Needs `venue: manage`, and an active ground.",
);

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
    "Needs `staff: manage`, and a venue an admin has approved (`PROVISIONING`, `LIVE` or " +
    "`MAINTENANCE`). Sends a WhatsApp message with a link that opens the dashboard app; if " +
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
    409: problemResponse(
      "ALREADY_A_MEMBER, or VENUE_STATUS_CONFLICT: not approved yet (with `venueStatus`).",
    ),
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
