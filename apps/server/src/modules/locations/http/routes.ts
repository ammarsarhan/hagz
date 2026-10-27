import { createRoute } from "@hono/zod-openapi";
import { list, Marketplace } from "@hagz/contracts";
import { requestLanguage } from "@/platform/http/language";
import { createRouter, problemResponse } from "@/platform/http/router";
import { listMarketplaces } from "../application/list-marketplaces";

const listMarketplacesRoute = createRoute({
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

export const locationsRoutes = createRouter().openapi(listMarketplacesRoute, async (c) => {
  const data = await listMarketplaces(requestLanguage(c));
  return c.json({ data }, 200);
});
