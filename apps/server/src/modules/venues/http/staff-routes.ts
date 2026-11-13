import { requestLanguage } from "@/platform/http/language";
import { createRouter } from "@/platform/http/router";
import { clientIp } from "@/platform/rate-limit/rate-limit";
import {
  acceptInvitation,
  declineInvitation,
  inviteStaff,
  listMyInvitations,
  listSentInvitations,
  previewInvitation,
  revokeInvitation,
} from "../application/invitations";
import {
  listMembers,
  listMyVenues,
  changePermissions,
  restorePermissions,
} from "../application/members";
import {
  putTranslation,
  setAmenities,
  updateSettings,
  updateVenue,
  venueDetail,
} from "../application/venue-edit";
import {
  confirmPhoto,
  listPhotos,
  removePhoto,
  reorderPhotos,
  requestPhotoUpload,
} from "../application/venue-media";
import {
  copySchedule,
  createGround,
  groundSchedule,
  listGrounds,
  putSchedule,
  removeGround,
  reorderGrounds,
  updateGround,
} from "../application/grounds";
import { createVenue, venueSetup } from "../application/venue-setup";
import * as route from "./definitions/staff";

export const venuesStaffRoutes = createRouter()
  .openapi(route.myVenues, async (c) => {
    const data = await listMyVenues(c.var.staff.staffId, requestLanguage(c));
    return c.json({ data }, 200);
  })
  .openapi(route.createVenue, async (c) => {
    const setup = await createVenue(c.var.staff.staffId, c.req.valid("json"), requestLanguage(c));
    return c.json(setup, 201);
  })
  .openapi(route.setup, async (c) => {
    return c.json(await venueSetup(c.var.venue.venueId, requestLanguage(c)), 200);
  })
  .openapi(route.venueDetail, async (c) => {
    return c.json(await venueDetail(c.var.venue.venueId), 200);
  })
  .openapi(route.updateVenue, async (c) => {
    return c.json(await updateVenue(c.var.venue, c.req.valid("json")), 200);
  })
  .openapi(route.putTranslation, async (c) => {
    const { language } = c.req.valid("param");
    return c.json(await putTranslation(c.var.venue, language, c.req.valid("json")), 200);
  })
  .openapi(route.updateSettings, async (c) => {
    return c.json(await updateSettings(c.var.venue, c.req.valid("json")), 200);
  })
  .openapi(route.setAmenities, async (c) => {
    return c.json(await setAmenities(c.var.venue, c.req.valid("json")), 200);
  })
  .openapi(route.photos, async (c) => {
    return c.json({ data: await listPhotos(c.var.venue.venueId) }, 200);
  })
  .openapi(route.requestPhotoUpload, async (c) => {
    return c.json(await requestPhotoUpload(c.var.venue, c.req.valid("json")), 201);
  })
  .openapi(route.confirmPhoto, async (c) => {
    return c.json(await confirmPhoto(c.var.venue, c.req.valid("param").photoId), 200);
  })
  .openapi(route.reorderPhotos, async (c) => {
    return c.json({ data: await reorderPhotos(c.var.venue, c.req.valid("json")) }, 200);
  })
  .openapi(route.removePhoto, async (c) => {
    await removePhoto(c.var.venue, c.req.valid("param").photoId);
    return c.body(null, 204);
  })
  .openapi(route.grounds, async (c) => {
    return c.json({ data: await listGrounds(c.var.venue.venueId, requestLanguage(c)) }, 200);
  })
  .openapi(route.createGround, async (c) => {
    return c.json(await createGround(c.var.venue, c.req.valid("json"), requestLanguage(c)), 201);
  })
  .openapi(route.reorderGrounds, async (c) => {
    const data = await reorderGrounds(c.var.venue, c.req.valid("json"), requestLanguage(c));
    return c.json({ data }, 200);
  })
  .openapi(route.updateGround, async (c) => {
    const { groundId } = c.req.valid("param");
    const ground = await updateGround(
      c.var.venue,
      groundId,
      c.req.valid("json"),
      requestLanguage(c),
    );
    return c.json(ground, 200);
  })
  .openapi(route.removeGround, async (c) => {
    await removeGround(c.var.venue, c.req.valid("param").groundId);
    return c.body(null, 204);
  })
  .openapi(route.groundSchedule, async (c) => {
    return c.json(await groundSchedule(c.var.venue.venueId, c.req.valid("param").groundId), 200);
  })
  .openapi(route.putSchedule, async (c) => {
    const { groundId } = c.req.valid("param");
    return c.json(await putSchedule(c.var.venue, groundId, c.req.valid("json")), 200);
  })
  .openapi(route.copySchedule, async (c) => {
    await copySchedule(c.var.venue, c.req.valid("param").groundId, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(route.members, async (c) => {
    return c.json({ data: await listMembers(c.var.venue.venueId) }, 200);
  })
  .openapi(route.setPermissions, async (c) => {
    const { staffId } = c.req.valid("param");
    const next = await changePermissions(c.var.venue, staffId, c.req.valid("json"));
    return c.json(next, 200);
  })
  .openapi(route.restore, async (c) => {
    const { staffId } = c.req.valid("param");
    return c.json(await restorePermissions(c.var.venue, staffId), 200);
  })
  .openapi(route.invite, async (c) => {
    const sent = await inviteStaff(c.var.venue, c.req.valid("json"), requestLanguage(c));
    return c.json(sent, 201);
  })
  .openapi(route.sentInvitations, async (c) => {
    return c.json({ data: await listSentInvitations(c.var.venue.venueId) }, 200);
  })
  .openapi(route.revokeSent, async (c) => {
    await revokeInvitation(c.var.venue, c.req.valid("param").invitationId);
    return c.body(null, 204);
  })
  .openapi(route.myInvitations, async (c) => {
    const data = await listMyInvitations(c.var.staff.staffId, requestLanguage(c));
    return c.json({ data }, 200);
  })
  .openapi(route.previewByCode, async (c) => {
    const { code } = c.req.valid("param");
    const context = { ip: clientIp(c), language: requestLanguage(c) };
    return c.json(await previewInvitation(c.var.staff.staffId, { code }, context), 200);
  })
  .openapi(route.acceptByCode, async (c) => {
    const { code } = c.req.valid("param");
    const context = { ip: clientIp(c), language: requestLanguage(c) };
    return c.json(await acceptInvitation(c.var.staff.staffId, { code }, context), 201);
  })
  .openapi(route.acceptById, async (c) => {
    const { invitationId: id } = c.req.valid("param");
    const context = { ip: clientIp(c), language: requestLanguage(c) };
    return c.json(await acceptInvitation(c.var.staff.staffId, { id }, context), 201);
  })
  .openapi(route.decline, async (c) => {
    await declineInvitation(c.var.staff.staffId, c.req.valid("param").invitationId);
    return c.body(null, 204);
  });
