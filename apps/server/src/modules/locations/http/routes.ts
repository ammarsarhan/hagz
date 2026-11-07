import { requestLanguage } from "@/platform/http/language";
import { createRouter } from "@/platform/http/router";
import { listMarketplaces } from "../application/list-marketplaces";
import * as route from "./definitions/locations";

export const locationsRoutes = createRouter().openapi(route.listMarketplaces, async (c) => {
  const data = await listMarketplaces(requestLanguage(c));
  return c.json({ data }, 200);
});
