import { createRoute, z } from "@hono/zod-openapi";
import {
  Amenity,
  Area,
  AreaQuery,
  list,
  Location,
  Marketplace,
  NearestAreaQuery,
} from "@hagz/contracts";
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

export const searchAreas = createRoute({
  method: "get",
  path: "/marketplaces/{code}/areas",
  tags: ["Locations"],
  summary: "Areas a venue can be filed under",
  description:
    "The leaves of the location tree, matching `q` in either language. With a point, nearest " +
    "first (areas without a centre last); without one, by name. Names follow `Accept-Language`. " +
    "Public.",
  request: { params: code, query: AreaQuery },
  responses: {
    200: { description: "Areas", ...json(list(Area)) },
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("MARKETPLACE_NOT_FOUND: no active marketplace with that code."),
    503: problemResponse("The database is unavailable; retry."),
  },
});

export const nearestArea = createRoute({
  method: "get",
  path: "/marketplaces/{code}/areas/nearest",
  tags: ["Locations"],
  summary: "The area to suggest for a point",
  description:
    "The area whose centre is nearest, if one is within 8 km; otherwise `area` is null and the " +
    "owner picks one or asks for theirs. Public.",
  request: { params: code, query: NearestAreaQuery },
  responses: {
    200: { description: "The suggestion", ...json(z.object({ area: Area.nullable() })) },
    400: problemResponse("VALIDATION_FAILED"),
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
