import { createRoute } from "@hono/zod-openapi";
import { list, Marketplace } from "@hagz/contracts";
import { problemResponse } from "@/platform/http/definitions";

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
