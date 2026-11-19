import { requestLanguage } from "@/platform/http/language";
import { createRouter } from "@/platform/http/router";
import { publicVenue, venueAvailability } from "../application/public-venue";
import * as route from "./definitions/public";

export const venuesPublicRoutes = createRouter()
  .openapi(route.publicVenue, async (c) => {
    return c.json(await publicVenue(c.req.valid("param").slug, requestLanguage(c)), 200);
  })
  .openapi(route.venueAvailability, async (c) => {
    const { slug } = c.req.valid("param");
    return c.json(await venueAvailability(slug, c.req.valid("query")), 200);
  });
