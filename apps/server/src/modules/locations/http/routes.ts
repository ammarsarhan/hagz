import { requestLanguage } from "@/platform/http/language";
import { createRouter } from "@/platform/http/router";
import {
  createAmenity,
  deleteAmenity,
  listAdminAmenities,
  updateAmenity,
} from "../application/admin-amenities";
import {
  createLocation,
  deleteLocation,
  listAdminLocations,
  updateLocation,
} from "../application/admin-locations";
import {
  createMarketplace,
  listAdminMarketplaces,
  updateMarketplace,
} from "../application/admin-marketplaces";
import { listMarketplaces } from "../application/list-marketplaces";
import { listAmenities, listLocations } from "../application/public-reference";
import * as admin from "./definitions/admin";
import * as route from "./definitions/locations";

export const locationsRoutes = createRouter()
  .openapi(route.listMarketplaces, async (c) => {
    const data = await listMarketplaces(requestLanguage(c));
    return c.json({ data }, 200);
  })
  .openapi(route.listLocations, async (c) => {
    const data = await listLocations(c.req.valid("param").code, requestLanguage(c));
    return c.json({ data }, 200);
  })
  .openapi(route.listAmenities, async (c) => {
    const data = await listAmenities(c.req.valid("param").code, requestLanguage(c));
    return c.json({ data }, 200);
  });

export const platformAdminRoutes = createRouter()
  .openapi(admin.listMarketplaces, async (c) => {
    return c.json({ data: await listAdminMarketplaces() }, 200);
  })
  .openapi(admin.createMarketplace, async (c) => {
    return c.json(await createMarketplace(c.req.valid("json"), c.var.admin.adminId), 201);
  })
  .openapi(admin.updateMarketplace, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await updateMarketplace(id, c.req.valid("json"), c.var.admin.adminId), 200);
  })
  .openapi(admin.listLocations, async (c) => {
    return c.json({ data: await listAdminLocations(c.req.valid("param").id) }, 200);
  })
  .openapi(admin.createLocation, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await createLocation(id, c.req.valid("json"), c.var.admin.adminId), 201);
  })
  .openapi(admin.updateLocation, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await updateLocation(id, c.req.valid("json"), c.var.admin.adminId), 200);
  })
  .openapi(admin.deleteLocation, async (c) => {
    await deleteLocation(c.req.valid("param").id, c.var.admin.adminId);
    return c.body(null, 204);
  })
  .openapi(admin.listAmenities, async (c) => {
    return c.json({ data: await listAdminAmenities(c.req.valid("param").id) }, 200);
  })
  .openapi(admin.createAmenity, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await createAmenity(id, c.req.valid("json"), c.var.admin.adminId), 201);
  })
  .openapi(admin.updateAmenity, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await updateAmenity(id, c.req.valid("json"), c.var.admin.adminId), 200);
  })
  .openapi(admin.deleteAmenity, async (c) => {
    await deleteAmenity(c.req.valid("param").id, c.var.admin.adminId);
    return c.body(null, 204);
  });
