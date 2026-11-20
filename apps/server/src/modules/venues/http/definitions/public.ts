import { createRoute, z } from "@hono/zod-openapi";
import {
  PublicVenue,
  VenueAvailability,
  VenueAvailabilityQuery,
  VenueFreeHours,
  VenueFreeHoursQuery,
  VenueCoverage,
  VenueCoverageQuery,
  VenueSearchQuery,
  VenueSearchResults,
  VenueSpread,
  VenueSpreadQuery,
} from "@hagz/contracts";
import { CUSTOMER_BEARER, optionalCustomer } from "@/platform/http/authenticate";
import { json, problemResponse } from "@/platform/http/definitions";

// The venue page (PR 3.2). Public: guests browse everything, and the web renders it for search
// engines.

// Either a customer's token or none (a guest): the empty requirement makes the token optional.
const guestOrCustomer: Record<string, string[]>[] = [{ [CUSTOMER_BEARER]: [] }, {}];

const slug = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .meta({ description: "The venue's permanent slug.", example: "k7m2x9pq" }),
});

const notFound = problemResponse(
  "VENUE_NOT_FOUND: no live or paused venue has that slug (drafts and venues in review aren't public).",
);

export const publicVenue = createRoute({
  method: "get",
  path: "/venues/{slug}",
  tags: ["Venues"],
  summary: "A venue's page",
  description:
    "Details, photos, amenities, grounds, map, rating, and how booking works there, including the " +
    "cancellation policy in plain words. Text follows `Accept-Language` (`ar` or `en`, Arabic by " +
    "default), else the language the venue wrote it in. Public.",
  request: { params: slug },
  responses: {
    200: { description: "The venue", ...json(PublicVenue) },
    404: notFound,
    503: problemResponse("The database is unavailable; retry."),
  },
});

export const venueAvailability = createRoute({
  method: "get",
  path: "/venues/{slug}/availability",
  tags: ["Venues"],
  summary: "A venue's free times on a day",
  description:
    "Every bookable slot that day, on every ground. A booking is back-to-back slots on one ground " +
    "(each starting where the last ends), between the ground's shortest and longest booking. " +
    "Read it fresh: booking checks again. Public.",
  request: { params: slug, query: VenueAvailabilityQuery },
  responses: {
    200: { description: "The day's free times", ...json(VenueAvailability) },
    400: problemResponse("VALIDATION_FAILED"),
    404: notFound,
    503: problemResponse("The database is unavailable; retry."),
  },
});

export const searchVenues = createRoute({
  method: "get",
  path: "/venues",
  tags: ["Venues"],
  summary: "Search venues",
  description:
    "Live venues by where (`area`, a point with `radius`, or part of the name in `q`; any mix) " +
    "with a ground free when asked: from `start` for `hours`, or any time on `date`, of the " +
    "`sport` and `size` asked for, and the other filters. Each card has its next free times. " +
    "Best match first unless `sort` says otherwise. Names follow `Accept-Language`. Public; " +
    "signed in, best match puts the player's own venues first and cards carry `you`.",
  middleware: [optionalCustomer] as const,
  security: guestOrCustomer,
  request: { query: VenueSearchQuery },
  responses: {
    200: { description: "A page of venues", ...json(VenueSearchResults) },
    400: problemResponse("VALIDATION_FAILED, or INVALID_CURSOR: search again."),
    401: problemResponse("TOKEN_EXPIRED or UNAUTHENTICATED: a token was sent and isn't good."),
    404: problemResponse("MARKETPLACE_NOT_FOUND: no active marketplace with that code."),
    503: problemResponse("The database is unavailable; retry."),
  },
});

export const freeHours = createRoute({
  method: "get",
  path: "/venues/free-hours",
  tags: ["Venues"],
  summary: "How many venues are free each hour of a day",
  description:
    "For each local hour of `date`, how many live venues (by the search's where and what) have a " +
    "ground free to start then, after their notice: the When sheet's timeline. Public.",
  request: { query: VenueFreeHoursQuery },
  responses: {
    200: { description: "Every hour of the day", ...json(VenueFreeHours) },
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("MARKETPLACE_NOT_FOUND: no active marketplace with that code."),
    503: problemResponse("The database is unavailable; retry."),
  },
});

export const venueSpread = createRoute({
  method: "get",
  path: "/venues/spread",
  tags: ["Venues"],
  summary: "How a search's venues spread over price and distance",
  description:
    "The venues a search finds, by their cheapest hour (leaving out the price range) and, with a " +
    "point, by how far they are (leaving out the radius): the Filters sheet's price chart and " +
    "Where's radius bars. Public.",
  request: { query: VenueSpreadQuery },
  responses: {
    200: { description: "Prices and distances", ...json(VenueSpread) },
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("MARKETPLACE_NOT_FOUND: no active marketplace with that code."),
    503: problemResponse("The database is unavailable; retry."),
  },
});

export const venueCoverage = createRoute({
  method: "get",
  path: "/venues/coverage",
  tags: ["Venues"],
  summary: "Where there are live venues",
  description:
    "Governorates with live venues, each with its areas and how many venues each has, most " +
    "first: Where's area picker. Names in `Accept-Language`. Public.",
  request: { query: VenueCoverageQuery },
  responses: {
    200: { description: "Governorates and their areas", ...json(VenueCoverage) },
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("MARKETPLACE_NOT_FOUND: no active marketplace with that code."),
    503: problemResponse("The database is unavailable; retry."),
  },
});
