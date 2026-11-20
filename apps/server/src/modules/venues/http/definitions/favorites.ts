import { createRoute, z } from "@hono/zod-openapi";
import { FavoriteVenues } from "@hagz/contracts";
import { CUSTOMER_BEARER, requireCustomer } from "@/platform/http/authenticate";
import { json, problemResponse } from "@/platform/http/definitions";

// Favorites (PR 3.4): the signed-in player's saved venues.

const tags = ["Favorites"];
const security = [{ [CUSTOMER_BEARER]: [] }];
const unauthenticated = problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED");
const unavailable = problemResponse("The database is unavailable; retry.");
const venueId = z.object({ venueId: z.uuid() });

export const listFavorites = createRoute({
  method: "get",
  path: "/customers/me/favorites",
  tags,
  summary: "List saved venues",
  description: "Most recently saved first. Names follow `Accept-Language`.",
  middleware: [requireCustomer] as const,
  security,
  responses: {
    200: { description: "Saved venues", ...json(FavoriteVenues) },
    401: unauthenticated,
    503: unavailable,
  },
});

export const saveFavorite = createRoute({
  method: "put",
  path: "/customers/me/favorites/{venueId}",
  tags,
  summary: "Save a venue",
  description: "Idempotent: saving a saved venue changes nothing. Live and paused venues only.",
  middleware: [requireCustomer] as const,
  security,
  request: { params: venueId },
  responses: {
    204: { description: "Saved" },
    401: unauthenticated,
    404: problemResponse("VENUE_NOT_FOUND: no listed venue with that id."),
    503: unavailable,
  },
});

export const removeFavorite = createRoute({
  method: "delete",
  path: "/customers/me/favorites/{venueId}",
  tags,
  summary: "Remove a saved venue",
  description: "Idempotent: removing a venue that isn't saved changes nothing.",
  middleware: [requireCustomer] as const,
  security,
  request: { params: venueId },
  responses: {
    204: { description: "Removed" },
    401: unauthenticated,
    503: unavailable,
  },
});
