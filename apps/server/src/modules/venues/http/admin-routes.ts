import { createRouter } from "@/platform/http/router";
import { getAdminVenue, listAdminVenues } from "../application/admin-venues";
import * as route from "./definitions/admin";

export const venuesAdminRoutes = createRouter()
  .openapi(route.listVenues, async (c) => {
    return c.json(await listAdminVenues(c.req.valid("query")), 200);
  })
  .openapi(route.getVenue, async (c) => {
    return c.json(await getAdminVenue(c.req.valid("param").id), 200);
  });
