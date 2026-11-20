import { requestLanguage } from "@/platform/http/language";
import { createRouter } from "@/platform/http/router";
import { listFavorites, removeFavorite, saveFavorite } from "../application/favorites";
import * as route from "./definitions/favorites";

export const venuesFavoriteRoutes = createRouter()
  .openapi(route.listFavorites, async (c) => {
    return c.json(await listFavorites(c.get("customer").customerId, requestLanguage(c)), 200);
  })
  .openapi(route.saveFavorite, async (c) => {
    await saveFavorite(c.get("customer").customerId, c.req.valid("param").venueId);
    return c.body(null, 204);
  })
  .openapi(route.removeFavorite, async (c) => {
    await removeFavorite(c.get("customer").customerId, c.req.valid("param").venueId);
    return c.body(null, 204);
  });
