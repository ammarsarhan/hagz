import { createRoute, z } from "@hono/zod-openapi";
import { PublicVenue, VenueAvailability, VenueAvailabilityQuery } from "@hagz/contracts";
import { json, problemResponse } from "@/platform/http/definitions";

// The venue page (PR 3.2). Public: guests browse everything, and the web renders it for search
// engines.

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
