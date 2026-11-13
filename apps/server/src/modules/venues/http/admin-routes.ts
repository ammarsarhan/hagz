import { createRouter } from "@/platform/http/router";
import { getAdminVenue, listAdminVenues } from "../application/admin-venues";
import {
  approveVenue,
  checkTaxNumber,
  goLive,
  pauseVenue,
  provisionTranslation,
  rejectVenue,
  resumeVenue,
  reviewQueue,
  venueHistory,
} from "../application/review";
import * as route from "./definitions/admin";

// The queue is registered before /admin/venues/{id}, so "review" isn't read as an id.
export const venuesAdminRoutes = createRouter()
  .openapi(route.listVenues, async (c) => {
    return c.json(await listAdminVenues(c.req.valid("query")), 200);
  })
  .openapi(route.reviewQueue, async (c) => {
    return c.json({ data: await reviewQueue() }, 200);
  })
  .openapi(route.getVenue, async (c) => {
    return c.json(await getAdminVenue(c.req.valid("param").id), 200);
  })
  .openapi(route.approveVenue, async (c) => {
    await approveVenue(c.var.admin.adminId, c.req.valid("param").id);
    return c.body(null, 204);
  })
  .openapi(route.rejectVenue, async (c) => {
    await rejectVenue(c.var.admin.adminId, c.req.valid("param").id, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(route.provisionTranslation, async (c) => {
    const { id, language } = c.req.valid("param");
    await provisionTranslation(c.var.admin.adminId, id, language, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(route.checkTaxNumber, async (c) => {
    await checkTaxNumber(c.var.admin.adminId, c.req.valid("param").id, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(route.goLive, async (c) => {
    await goLive(c.var.admin.adminId, c.req.valid("param").id);
    return c.body(null, 204);
  })
  .openapi(route.pauseVenue, async (c) => {
    await pauseVenue(c.req.valid("param").id, { adminId: c.var.admin.adminId });
    return c.body(null, 204);
  })
  .openapi(route.resumeVenue, async (c) => {
    await resumeVenue(c.req.valid("param").id, { adminId: c.var.admin.adminId });
    return c.body(null, 204);
  })
  .openapi(route.venueHistory, async (c) => {
    return c.json(await venueHistory(c.req.valid("param").id, c.req.valid("query")), 200);
  });
