import { createRoute } from "@hono/zod-openapi";
import { accepts } from "hono/accepts";
import { list, Marketplace } from "@hagz/contracts";
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
  const language = accepts(c, { header: "Accept-Language", supports: ["ar", "en"], default: "ar" });
  const data = await listMarketplaces(language === "en" ? "EN" : "AR");
  return c.json({ data }, 200);
});
