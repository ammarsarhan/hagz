import { randomUUID } from "node:crypto";
import {
  list,
  ReceivedStaffInvitation,
  StaffInvitation,
  StaffVenue,
  type StaffPermissions,
} from "@hagz/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "@/http/router";
import { signJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import { messaging } from "@/platform/messaging/messaging";
import { resetDatabase } from "../../support/database";
import { addMember, createMarketplace, createStaff, createVenue } from "../../support/factories";
import { outbox } from "../../support/messaging";
import { deleteRedisKeys, resetRedis } from "../../support/redis";

const INVITEE = "+201005550000";

const permissions = (overrides: Partial<StaffPermissions> = {}): StaffPermissions => ({
  bookings: "none",
  customers: "none",
  schedule: "none",
  payments: "none",
  finance: "none",
  staff: "none",
  venue: "none",
  ...overrides,
});

const call = async (staffId: string, method: string, path: string, body?: unknown) =>
  router.request(`/v1/staff${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${await signJwt({ sub: staffId, sid: randomUUID() }, { audience: "staff", ttlSeconds: 600 })}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const problem = async (res: Response) => {
  const body = (await res.json()) as Record<string, unknown>;
  delete body.requestId;
  return body;
};

// The code at the end of the link WhatsApp delivered to `phone`.
const codeSentTo = (phone: string) =>
  new URL(outbox.lastInvitationTo(phone)?.link ?? "http://x/").pathname.split("/").pop() ?? "";

let phones = 0;
const someStaff = (phone = `+2010011${String(phones++).padStart(5, "0")}`) =>
  createStaff({ phone });

// A venue with an owner and a manager who manages staff and views bookings.
const venueWithStaff = async () => {
  const { id: marketplaceId } = await createMarketplace();
  const venue = await createVenue(marketplaceId);
  await prisma.venueTranslation.createMany({
    data: [
      { venueId: venue.id, language: "EN", name: "Goal Arena", description: "", address: "" },
      { venueId: venue.id, language: "AR", name: "ملعب الهدف", description: "", address: "" },
    ],
  });
  const [owner, manager] = [await someStaff(), await someStaff()];
  await addMember(venue.id, owner.id, { role: "OWNER", permissions: permissions() });
  await addMember(venue.id, manager.id, {
    permissions: permissions({ staff: "manage", bookings: "view" }),
  });
  return { venue, owner, manager };
};

const invite = (inviterId: string, venueId: string, body: unknown) =>
  call(inviterId, "POST", `/venues/${venueId}/invitations`, body);

beforeEach(async () => {
  phones = 0;
  vi.restoreAllMocks();
  await resetDatabase();
  await resetRedis();
  outbox.invitations.length = 0;
});

describe("sending an invitation", () => {
  it("sends a WhatsApp link to the app, in the invitee's language when they have an account", async () => {
    const { venue, manager } = await venueWithStaff();
    await createStaff({ phone: INVITEE, language: "EN" });

    const res = await invite(manager.id, venue.id, {
      phone: "+20 100 555 0000",
      permissions: permissions({ bookings: "view" }),
    });
    expect(res.status).toBe(201);
    const sent = StaffInvitation.parse(await res.json());
    expect(sent).toMatchObject({ phone: INVITEE, invitedBy: "Mona" });
    expect(JSON.stringify(sent)).not.toMatch(/code/i);

    const message = outbox.lastInvitationTo(INVITEE);
    expect(message).toMatchObject({ venueName: "Goal Arena", invitedBy: "Mona", language: "EN" });
    expect(message?.link).toMatch(
      /^http:\/\/localhost:3001\/manage\/invite\/[A-HJ-KM-NP-Z2-9]{6}$/,
    );
  });

  it("also shows it in the app of someone who already has an account", async () => {
    const { venue, manager } = await venueWithStaff();
    const invitee = await createStaff({ phone: INVITEE });
    await invite(manager.id, venue.id, { phone: INVITEE, permissions: permissions() });

    const notification = await prisma.notification.findFirstOrThrow({
      where: { staffId: invitee.id },
    });
    expect(notification).toMatchObject({ type: "STAFF_INVITED", venueId: venue.id });
  });

  it("defaults to the venue's default permissions", async () => {
    const { venue, owner } = await venueWithStaff();
    await prisma.venueSettings.create({
      data: { venueId: venue.id, defaultPermissions: permissions({ bookings: "manage" }) },
    });
    const res = await invite(owner.id, venue.id, { phone: INVITEE });
    expect(StaffInvitation.parse(await res.json()).permissions).toEqual(
      permissions({ bookings: "manage" }),
    );
  });

  it("can't give more than the inviter has, unless the owner invites", async () => {
    const { venue, owner, manager } = await venueWithStaff();
    const more = permissions({ bookings: "manage", finance: "view" });

    const res = await invite(manager.id, venue.id, { phone: INVITEE, permissions: more });
    expect(res.status).toBe(403);
    expect(await problem(res)).toMatchObject({
      code: "PERMISSION_ABOVE_YOUR_OWN",
      areas: ["bookings", "finance"],
    });
    expect(outbox.invitations).toHaveLength(0);
    expect((await invite(owner.id, venue.id, { phone: INVITEE, permissions: more })).status).toBe(
      201,
    );
  });

  it("needs staff: manage, and only for venues the inviter belongs to", async () => {
    const { venue, owner } = await venueWithStaff();
    const viewer = await someStaff();
    await addMember(venue.id, viewer.id, { permissions: permissions({ staff: "view" }) });
    expect((await invite(viewer.id, venue.id, { phone: INVITEE })).status).toBe(403);

    const { venue: other } = await venueWithStaff();
    const res = await invite(owner.id, other.id, { phone: INVITEE });
    expect(res.status).toBe(404);
    expect(await prisma.venueInvitation.count()).toBe(0);
  });

  it("refuses someone already on the staff", async () => {
    const { venue, owner, manager } = await venueWithStaff();
    const res = await invite(owner.id, venue.id, { phone: manager.phone });
    expect(res.status).toBe(409);
    expect((await problem(res)).code).toBe("ALREADY_A_MEMBER");
  });

  it("replaces an earlier invitation to the same number", async () => {
    const { venue, owner } = await venueWithStaff();
    await invite(owner.id, venue.id, { phone: INVITEE });
    const first = codeSentTo(INVITEE);
    await deleteRedisKeys("ratelimit:*");
    await invite(owner.id, venue.id, { phone: INVITEE });

    const open = await call(owner.id, "GET", `/venues/${venue.id}/invitations`);
    expect(list(StaffInvitation).parse(await open.json()).data).toHaveLength(1);

    const invitee = await createStaff({ phone: INVITEE });
    const stale = await call(invitee.id, "POST", `/invitations/code/${first}/accept`);
    expect(stale.status).toBe(410);
  });

  it("leaves nothing behind when WhatsApp can't send it", async () => {
    const { venue, owner } = await venueWithStaff();
    await createStaff({ phone: INVITEE });
    vi.spyOn(messaging, "sendStaffInvitation").mockRejectedValueOnce(new Error("Meta is down"));

    const res = await invite(owner.id, venue.id, { phone: INVITEE });
    expect(res.status).toBe(500);
    expect(await prisma.venueInvitation.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
    expect(await prisma.venueEvent.count()).toBe(0);
  });
});

describe("answering an invitation", () => {
  const sendTo = async (phone = INVITEE, granted = permissions({ bookings: "view" })) => {
    const scene = await venueWithStaff();
    const res = await invite(scene.manager.id, scene.venue.id, { phone, permissions: granted });
    expect(res.status).toBe(201);
    return { ...scene, invitationId: StaffInvitation.parse(await res.json()).id };
  };

  it("joins from the link's code, typed in any case", async () => {
    const { venue, owner, manager } = await sendTo();
    const invitee = await createStaff({ phone: INVITEE });
    const code = codeSentTo(INVITEE);

    const preview = await call(invitee.id, "GET", `/invitations/code/${code}`);
    expect(ReceivedStaffInvitation.parse(await preview.json())).toMatchObject({
      venue: { id: venue.id },
      invitedBy: "Mona",
      permissions: permissions({ bookings: "view" }),
    });

    const typed = `${code.slice(0, 3).toLowerCase()}-${code.slice(3)}`;
    const res = await call(invitee.id, "POST", `/invitations/code/${typed}/accept`);
    expect(res.status).toBe(201);
    expect(StaffVenue.parse(await res.json())).toMatchObject({
      id: venue.id,
      role: "MEMBER",
      permissions: permissions({ bookings: "view" }),
    });

    // The owner and the staff manager hear who joined, and it's on the venue's record.
    const told = await prisma.notification.findMany({ where: { type: "STAFF_JOINED" } });
    expect(told.map((n) => n.staffId).sort()).toEqual([owner.id, manager.id].sort());
    expect(await prisma.venueEvent.findFirst({ where: { type: "STAFF_JOINED" } })).toMatchObject({
      staffId: invitee.id,
    });

    const again = await call(invitee.id, "POST", `/invitations/code/${code}/accept`);
    expect(again.status).toBe(410);
  });

  it("lists invitations from every venue for an existing account, and joins by id", async () => {
    const invitee = await createStaff({ phone: INVITEE });
    const first = await sendTo();
    const second = await sendTo();

    const inbox = await call(invitee.id, "GET", "/invitations");
    const received = list(ReceivedStaffInvitation).parse(await inbox.json()).data;
    expect(received.map((r) => r.venue.id).sort()).toEqual(
      [first.venue.id, second.venue.id].sort(),
    );

    const res = await call(invitee.id, "POST", `/invitations/${first.invitationId}/accept`);
    expect(res.status).toBe(201);
    const venues = list(StaffVenue).parse(await (await call(invitee.id, "GET", "/venues")).json());
    expect(venues.data.map((v) => v.id)).toEqual([first.venue.id]);
    const left = list(ReceivedStaffInvitation).parse(
      await (await call(invitee.id, "GET", "/invitations")).json(),
    );
    expect(left.data.map((r) => r.id)).toEqual([second.invitationId]);
  });

  it("is only for the invited number: anyone else gets not found, by code or by id", async () => {
    const { invitationId } = await sendTo();
    const code = codeSentTo(INVITEE);
    const stranger = await someStaff();

    for (const [method, path] of [
      ["GET", `/invitations/code/${code}`],
      ["POST", `/invitations/code/${code}/accept`],
      ["POST", `/invitations/${invitationId}/accept`],
      ["POST", `/invitations/${invitationId}/decline`],
    ] as const) {
      const res = await call(stranger.id, method, path);
      expect(res.status, path).toBe(404);
    }
    expect(await prisma.venueMembership.count({ where: { staffId: stranger.id } })).toBe(0);
    expect(await prisma.venueInvitation.count({ where: { revokedAt: null } })).toBe(1);
  });

  it("can be declined, and then can't be accepted", async () => {
    const { invitationId } = await sendTo();
    const invitee = await createStaff({ phone: INVITEE });
    expect((await call(invitee.id, "POST", `/invitations/${invitationId}/decline`)).status).toBe(
      204,
    );
    expect((await call(invitee.id, "POST", `/invitations/${invitationId}/accept`)).status).toBe(
      410,
    );
  });

  it("stops working when it expires or the venue withdraws it", async () => {
    const { venue, manager, invitationId } = await sendTo();
    const invitee = await createStaff({ phone: INVITEE });
    const withdrawn = await call(
      manager.id,
      "DELETE",
      `/venues/${venue.id}/invitations/${invitationId}`,
    );
    expect(withdrawn.status).toBe(204);
    expect((await call(invitee.id, "POST", `/invitations/${invitationId}/accept`)).status).toBe(
      410,
    );

    const later = await sendTo(INVITEE);
    await prisma.venueInvitation.update({
      where: { id: later.invitationId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (await call(invitee.id, "POST", `/invitations/${later.invitationId}/accept`)).status,
    ).toBe(410);
  });

  it("is only as good as its inviter is now", async () => {
    const { venue, owner, manager, invitationId } = await sendTo();
    const invitee = await createStaff({ phone: INVITEE });
    // The manager lost the right to manage staff after sending it.
    await call(owner.id, "PUT", `/venues/${venue.id}/members/${manager.id}/permissions`, {
      ...permissions({ bookings: "view" }),
    });

    const res = await call(invitee.id, "POST", `/invitations/${invitationId}/accept`);
    expect(res.status).toBe(410);
    expect(await prisma.venueMembership.count({ where: { staffId: invitee.id } })).toBe(0);
  });

  it("can't be withdrawn through another venue", async () => {
    const { invitationId } = await sendTo();
    const { venue: other, owner: otherOwner } = await venueWithStaff();
    const res = await call(
      otherOwner.id,
      "DELETE",
      `/venues/${other.id}/invitations/${invitationId}`,
    );
    expect(res.status).toBe(404);
    expect(await prisma.venueInvitation.count({ where: { revokedAt: null } })).toBe(1);
  });
});
