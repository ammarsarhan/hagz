import { createRoute, z } from "@hono/zod-openapi";
import {
  AdminAmenity,
  AdminLocation,
  AdminMarketplace,
  CreateAmenity,
  CreateLocation,
  CreateMarketplace,
  list,
  UpdateAmenity,
  UpdateLocation,
  UpdateMarketplace,
} from "@hagz/contracts";
import { ADMIN_COOKIE_AUTH, ADMIN_CSRF_HEADER, requireAdmin } from "@/platform/http/authenticate";
import { body, json, problemResponse } from "@/platform/http/definitions";

// Admin routes for the Platform page: marketplaces, their location trees and amenity catalogs.

const tags = ["Platform"];
const security = [{ [ADMIN_COOKIE_AUTH]: [] }];
const guarded = {
  401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED: refresh, or sign in."),
  403: problemResponse(`ADMIN_HEADER_REQUIRED: send \`${ADMIN_CSRF_HEADER}: 1\`.`),
};
const invalid = problemResponse("VALIDATION_FAILED: see `errors`.");
const id = z.object({ id: z.uuid() });
const marketplaceNotFound = problemResponse("MARKETPLACE_NOT_FOUND");

// --- Marketplaces ---

export const listMarketplaces = createRoute({
  method: "get",
  path: "/admin/marketplaces",
  tags,
  summary: "Every marketplace, hidden ones included",
  middleware: [requireAdmin] as const,
  security,
  responses: {
    200: { description: "By code", ...json(list(AdminMarketplace)) },
    ...guarded,
  },
});

export const createMarketplace = createRoute({
  method: "post",
  path: "/admin/marketplaces",
  tags,
  summary: "Add a marketplace",
  description: "It starts hidden from the apps; turn it on with `isActive` when it's ready.",
  middleware: [requireAdmin] as const,
  security,
  request: body(CreateMarketplace),
  responses: {
    201: { description: "Created", ...json(AdminMarketplace) },
    ...guarded,
    409: problemResponse("MARKETPLACE_EXISTS: that code is taken."),
    400: invalid,
  },
});

export const updateMarketplace = createRoute({
  method: "patch",
  path: "/admin/marketplaces/{id}",
  tags,
  summary: "Edit a marketplace, or show or hide it",
  description:
    "Only the fields sent change. VAT and commission apply to bookings made afterwards. Marketplaces " +
    "are never deleted; hide one with `isActive: false`.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: id, ...body(UpdateMarketplace) },
  responses: {
    200: { description: "Updated", ...json(AdminMarketplace) },
    ...guarded,
    404: marketplaceNotFound,
    409: problemResponse(
      "MARKETPLACE_IN_USE: `code` or `currency` changed after it got locations, venues or " +
        "amenities (`fields` lists which); MARKETPLACE_EXISTS: the new code is taken; " +
        "LAST_LIVE_MARKETPLACE: `isActive: false` on the only live marketplace.",
    ),
    400: invalid,
  },
});

// --- Locations ---

export const listLocations = createRoute({
  method: "get",
  path: "/admin/marketplaces/{id}/locations",
  tags,
  summary: "A marketplace's locations",
  description: "Every location, flat: build the tree from `parentId`.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: id },
  responses: {
    200: { description: "Locations", ...json(list(AdminLocation)) },
    ...guarded,
    404: marketplaceNotFound,
  },
});

export const createLocation = createRoute({
  method: "post",
  path: "/admin/marketplaces/{id}/locations",
  tags,
  summary: "Add a location",
  description:
    "At the top of the tree, or under `parentId`. The slug is made from the English name and " +
    "never changes.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: id, ...body(CreateLocation) },
  responses: {
    201: { description: "Created", ...json(AdminLocation) },
    ...guarded,
    404: marketplaceNotFound,
    409: problemResponse("LOCATION_EXISTS: a sibling already has this slug (`slug`)."),
    400: invalid,
    422: problemResponse("PARENT_NOT_FOUND: `parentId` isn't in this marketplace."),
  },
});

export const updateLocation = createRoute({
  method: "patch",
  path: "/admin/locations/{id}",
  tags,
  summary: "Rename a location or change its kind",
  description: "The slug stays as it was.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: id, ...body(UpdateLocation) },
  responses: {
    200: { description: "Updated", ...json(AdminLocation) },
    ...guarded,
    404: problemResponse("LOCATION_NOT_FOUND"),
    400: invalid,
  },
});

export const deleteLocation = createRoute({
  method: "delete",
  path: "/admin/locations/{id}",
  tags,
  summary: "Remove a location",
  description: "Only while it has no locations under it and no venues in it.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: id },
  responses: {
    204: { description: "Removed" },
    ...guarded,
    404: problemResponse("LOCATION_NOT_FOUND"),
    409: problemResponse("LOCATION_IN_USE: it has locations under it or venues in it."),
  },
});

// --- Amenities ---

export const listAmenities = createRoute({
  method: "get",
  path: "/admin/marketplaces/{id}/amenities",
  tags,
  summary: "A marketplace's amenity options, inactive ones included",
  middleware: [requireAdmin] as const,
  security,
  request: { params: id },
  responses: {
    200: { description: "By key", ...json(list(AdminAmenity)) },
    ...guarded,
    404: marketplaceNotFound,
  },
});

export const createAmenity = createRoute({
  method: "post",
  path: "/admin/marketplaces/{id}/amenities",
  tags,
  summary: "Add an amenity option",
  middleware: [requireAdmin] as const,
  security,
  request: { params: id, ...body(CreateAmenity) },
  responses: {
    201: { description: "Created", ...json(AdminAmenity) },
    ...guarded,
    404: marketplaceNotFound,
    409: problemResponse("AMENITY_EXISTS: this marketplace already has that key."),
    400: invalid,
  },
});

export const updateAmenity = createRoute({
  method: "patch",
  path: "/admin/amenities/{id}",
  tags,
  summary: "Rename an amenity option, or turn it on or off",
  description: "Turned off, venues can't newly pick it; venues that offer it keep it.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: id, ...body(UpdateAmenity) },
  responses: {
    200: { description: "Updated", ...json(AdminAmenity) },
    ...guarded,
    404: problemResponse("AMENITY_NOT_FOUND"),
    400: invalid,
  },
});

export const deleteAmenity = createRoute({
  method: "delete",
  path: "/admin/amenities/{id}",
  tags,
  summary: "Remove an amenity option",
  description: "Only while no venue offers it and no booking was charged for it; else turn it off.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: id },
  responses: {
    204: { description: "Removed" },
    ...guarded,
    404: problemResponse("AMENITY_NOT_FOUND"),
    409: problemResponse("AMENITY_IN_USE: venues offer it or bookings were charged for it."),
  },
});
