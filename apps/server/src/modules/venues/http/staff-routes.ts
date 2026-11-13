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
