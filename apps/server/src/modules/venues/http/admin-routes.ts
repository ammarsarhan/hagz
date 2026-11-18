import { createRouter } from "@/platform/http/router";
import {
  adminVenueAmenities,
  adminVenueGrounds,
  adminVenueInvitations,
  adminVenueLocation,
  adminVenueMembers,
  adminVenuePhotos,
  adminVenueTranslations,
  getAdminVenue,
  listAdminVenues,
  regenerateGround,
} from "../application/admin-venues";
import { daySlots } from "../application/day-slots";
import {
  approveVenue,
  checkTaxNumber,
  goLive,
  pauseVenue,
  provisionTranslation,
  rejectVenue,
  resumeVenue,
  reviewQueue,
  setVenueArea,
  venueContact,
  venueHistory,
  venueOverview,
} from "../application/review";
import {
  banStaff,
  reactivateStaff,
  removeMember,
  revokeInvitationAsAdmin,
  suspendStaff,
  transferOwnership,
} from "../application/admin-team";
import {
  adminVenueSettings,
  setCommission,
  updateSettingsAsAdmin,
} from "../application/admin-settings";
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
  .openapi(route.setVenueArea, async (c) => {
    await setVenueArea(c.var.admin.adminId, c.req.valid("param").id, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(route.venueTranslations, async (c) => {
    return c.json({ data: await adminVenueTranslations(c.req.valid("param").id) }, 200);
  })
  .openapi(route.venuePhotos, async (c) => {
    return c.json({ data: await adminVenuePhotos(c.req.valid("param").id) }, 200);
  })
  .openapi(route.venueLocation, async (c) => {
    return c.json(await adminVenueLocation(c.req.valid("param").id), 200);
  })
  .openapi(route.venueAmenities, async (c) => {
    return c.json(await adminVenueAmenities(c.req.valid("param").id), 200);
  })
  .openapi(route.venueContact, async (c) => {
    return c.json(await venueContact(c.req.valid("param").id), 200);
  })
  .openapi(route.venueSettings, async (c) => {
    return c.json(await adminVenueSettings(c.req.valid("param").id), 200);
  })
  .openapi(route.updateVenueSettings, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await updateSettingsAsAdmin(c.var.admin.adminId, id, c.req.valid("json")), 200);
  })
  .openapi(route.setVenueCommission, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await setCommission(c.var.admin.adminId, id, c.req.valid("json")), 200);
  })
  .openapi(route.venueGrounds, async (c) => {
    return c.json(await adminVenueGrounds(c.req.valid("param").id), 200);
  })
  .openapi(route.regenerateGround, async (c) => {
    const { id, groundId } = c.req.valid("param");
    await regenerateGround(id, groundId);
    return c.body(null, 202);
  })
  .openapi(route.venueSlots, async (c) => {
    return c.json(await daySlots(c.req.valid("param").id, c.req.valid("query")), 200);
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
  .openapi(route.venueOverview, async (c) => {
    return c.json(await venueOverview(c.req.valid("param").id), 200);
  })
  .openapi(route.venueHistory, async (c) => {
    return c.json(await venueHistory(c.req.valid("param").id, c.req.valid("query")), 200);
  })
  .openapi(route.venueMembers, async (c) => {
    return c.json({ data: await adminVenueMembers(c.req.valid("param").id) }, 200);
  })
  .openapi(route.venueInvitations, async (c) => {
    return c.json({ data: await adminVenueInvitations(c.req.valid("param").id) }, 200);
  })
  .openapi(route.removeMember, async (c) => {
    const { id, staffId } = c.req.valid("param");
    await removeMember(c.var.admin.adminId, id, staffId, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(route.revokeInvitation, async (c) => {
    const { id, invitationId } = c.req.valid("param");
    await revokeInvitationAsAdmin(c.var.admin.adminId, id, invitationId);
    return c.body(null, 204);
  })
  .openapi(route.transferOwnership, async (c) => {
    await transferOwnership(c.var.admin.adminId, c.req.valid("param").id, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(route.suspendStaff, async (c) => {
    await suspendStaff(c.var.admin.adminId, c.req.valid("param").staffId, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(route.banStaff, async (c) => {
    await banStaff(c.var.admin.adminId, c.req.valid("param").staffId, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(route.reactivateStaff, async (c) => {
    await reactivateStaff(c.var.admin.adminId, c.req.valid("param").staffId);
    return c.body(null, 204);
  });
