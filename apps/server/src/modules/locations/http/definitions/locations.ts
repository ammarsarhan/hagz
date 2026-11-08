import { createRoute, z } from "@hono/zod-openapi";
import { Amenity, list, Location, Marketplace } from "@hagz/contracts";
import { json, problemResponse } from "@/platform/http/definitions";

export const listMarketplaces = createRoute({
  method: "get",
  path: "/marketplaces",
  tags: ["Locations"],
  summary: "List the countries Hagz operates in",
  description: "Names follow `Accept-Language` (`ar` or `en`, Arabic by default). Public.",
  responses: {
    200: {
      description: "Active marketplaces",
      content: { "application/json": { schema: list(Marketplace) } },
    },
    503: problemResponse("The database is unavailable; retry."),
  },
});

const code = z.object({
  code: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .meta({ description: "The marketplace's ISO 3166-1 alpha-2 code.", example: "EG" }),
});

export const listLocations = createRoute({
  method: "get",
  path: "/marketplaces/{code}/locations",
  tags: ["Locations"],
  summary: "A marketplace's location tree",
  description:
    "Every location, flat: build the tree from `parentId`. Names follow `Accept-Language`. Public.",
  request: { params: code },
  responses: {
    200: { description: "Locations", ...json(list(Location)) },
    404: problemResponse("MARKETPLACE_NOT_FOUND: no active marketplace with that code."),
    503: problemResponse("The database is unavailable; retry."),
  },
});

export const listAmenities = createRoute({
  method: "get",
  path: "/marketplaces/{code}/amenities",
  tags: ["Locations"],
  summary: "A marketplace's amenity options",
  description: "The options venues can offer. Names follow `Accept-Language`. Public.",
  request: { params: code },
  responses: {
    200: { description: "Active amenity options", ...json(list(Amenity)) },
    404: problemResponse("MARKETPLACE_NOT_FOUND: no active marketplace with that code."),
    503: problemResponse("The database is unavailable; retry."),
  },
});
