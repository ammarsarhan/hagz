import { requestLanguage } from "@/platform/http/language";
import { createRouter } from "@/platform/http/router";
import { publicVenue, venueAvailability } from "../application/public-venue";
import { freeHours, searchVenues, venueCoverage, venueSpread } from "../application/venue-search";
import * as route from "./definitions/public";

export const venuesPublicRoutes = createRouter()
  .openapi(route.searchVenues, async (c) => {
    return c.json(await searchVenues(c.req.valid("query"), requestLanguage(c)), 200);
  })
  // These three before /venues/{slug}, which would otherwise take their names for slugs.
  .openapi(route.freeHours, async (c) => {
    return c.json(await freeHours(c.req.valid("query")), 200);
  })
  .openapi(route.venueSpread, async (c) => {
    return c.json(await venueSpread(c.req.valid("query")), 200);
  })
  .openapi(route.venueCoverage, async (c) => {
    return c.json(await venueCoverage(c.req.valid("query"), requestLanguage(c)), 200);
  })
  .openapi(route.publicVenue, async (c) => {
    return c.json(await publicVenue(c.req.valid("param").slug, requestLanguage(c)), 200);
  })
  .openapi(route.venueAvailability, async (c) => {
    const { slug } = c.req.valid("param");
    return c.json(await venueAvailability(slug, c.req.valid("query")), 200);
  });
