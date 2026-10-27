import { StaffAuthenticated, type StaffPermissions } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { restrictAfterPasswordReset } from "@/modules/venues";
import { systemClock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { resetDatabase } from "../../support/database";
import { addMember, createMarketplace, createStaff, createVenue } from "../../support/factories";
import { outbox } from "../../support/messaging";
import { resetRedis } from "../../support/redis";

// A staff password reset can be done by whoever now holds a recycled number, so (decided 2026-10-26):
// members become read-only everywhere and their managers are told; owners can't reset by themselves.

const PHONE = "+201001234567";
const PASSWORD = "correct horse battery";
const NEW_PASSWORD = "a brand new passphrase";

const post = (path: string, body: unknown) =>
  router.request(`/v1/auth/staff${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

const requestReset = () => post("/password-resets", { phone: PHONE });
const confirmReset = (code: string) =>
  post("/password-resets/confirm", { phone: PHONE, code, newPassword: NEW_PASSWORD });
const reset = async () => {
  expect((await requestReset()).status).toBe(202);
  const res = await confirmReset(outbox.lastCodeFor(PHONE) ?? "");
  expect(res.status).toBe(204);
};
const signIn = (password: string) => post("/sessions", { phone: PHONE, password });

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

const membership = (venueId: string, staffId: string) =>
  prisma.venueMembership.findUniqueOrThrow({ where: { venueId_staffId: { venueId, staffId } } });

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  outbox.sent.length = 0;
});

describe("staff password reset, for a member", () => {
  it("lowers every permission to at most view at every venue, never raising one", async () => {
    const { id: marketplaceId } = await createMarketplace();
    const [first, second] = [await createVenue(marketplaceId), await createVenue(marketplaceId)];
    const member = await createStaff();
    const before = permissions({ bookings: "manage", customers: "view", staff: "manage" });
    await addMember(first.id, member.id, { permissions: before });
    await addMember(second.id, member.id, { permissions: permissions({ schedule: "manage" }) });

    await reset();

    expect((await membership(first.id, member.id)).permissions).toEqual(
      permissions({ bookings: "view", customers: "view", staff: "view" }),
    );
    expect((await membership(second.id, member.id)).permissions).toEqual(
      permissions({ schedule: "view" }),
    );

    // The new password works, and the old one doesn't.
    expect((await signIn(NEW_PASSWORD)).status).toBe(201);
    expect((await signIn(PASSWORD)).status).toBe(401);
  });

  it("keeps the previous permissions for restore, in an event the member is the actor of", async () => {
    const { id: marketplaceId } = await createMarketplace();
    const venue = await createVenue(marketplaceId);
    const member = await createStaff();
    const before = permissions({ bookings: "manage", finance: "view" });
    await addMember(venue.id, member.id, { permissions: before });

    await reset();

    const [event] = await prisma.venueEvent.findMany({ where: { venueId: venue.id } });
    expect(event).toMatchObject({
      type: "STAFF_RESTRICTED_AFTER_PASSWORD_RESET",
      staffId: member.id,
      adminId: null,
      data: {
        previousPermissions: before,
        permissions: permissions({ bookings: "view", finance: "view" }),
      },
    });
  });

  it("notifies the owner and members who manage staff, nobody else", async () => {
    const { id: marketplaceId } = await createMarketplace();
    const venue = await createVenue(marketplaceId);
    const member = await createStaff();
    const owner = await createStaff({ phone: "+201001110000" });
    const manager = await createStaff({ phone: "+201001110001" });
    const viewer = await createStaff({ phone: "+201001110002" });
    // The owner's stored permissions don't matter: owners can do everything.
    await addMember(venue.id, owner.id, { role: "OWNER", permissions: permissions() });
    await addMember(venue.id, manager.id, { permissions: permissions({ staff: "manage" }) });
    await addMember(venue.id, viewer.id, { permissions: permissions({ staff: "view" }) });
    // The member managed staff too; they aren't told about their own reset.
    await addMember(venue.id, member.id, { permissions: permissions({ staff: "manage" }) });

    await reset();

    const notifications = await prisma.notification.findMany({ include: { deliveries: true } });
    expect(notifications.map((n) => n.staffId).sort()).toEqual([owner.id, manager.id].sort());
    const event = await prisma.venueEvent.findFirstOrThrow();
    for (const notification of notifications) {
      expect(notification).toMatchObject({
        type: "STAFF_PASSWORD_RESET",
        venueId: venue.id,
        data: { staffId: member.id, eventId: event.id },
        readAt: null,
      });
      expect(notification.deliveries).toEqual([
        expect.objectContaining({ channel: "PUSH", status: "PENDING" }),
      ]);
    }
  });

  it("treats permissions it can't read as none", async () => {
    const { id: marketplaceId } = await createMarketplace();
    const venue = await createVenue(marketplaceId);
    const member = await createStaff();
    await addMember(venue.id, member.id, { permissions: { bookings: "everything" } });

    await reset();

    expect((await membership(venue.id, member.id)).permissions).toEqual(permissions());
  });

  it("works for staff who belong to no venue yet", async () => {
    await createStaff();
    await reset();
    expect(await prisma.venueEvent.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
  });

  it("signs out every staff session", async () => {
    const member = await createStaff();
    const signedIn = StaffAuthenticated.parse(await (await signIn(PASSWORD)).json());

    await reset();

    expect(
      await prisma.staffSession.count({ where: { staffId: member.id, revokedAt: null } }),
    ).toBe(0);
    const refresh = await post("/sessions/refresh", {
      refreshToken: signedIn.session.refreshToken,
    });
    expect(refresh.status).toBe(401);
  });
});

describe("staff password reset, for an owner", () => {
  it("answers like any other number but sends no code", async () => {
    const { id: marketplaceId } = await createMarketplace();
    const venue = await createVenue(marketplaceId);
    const owner = await createStaff();
    await addMember(venue.id, owner.id, { role: "OWNER", permissions: permissions() });

    const res = await requestReset();
    expect(res.status).toBe(202);
    expect(await json(res)).toEqual({ expiresIn: 600, resendAfter: 60 });
    expect(outbox.sent).toHaveLength(0);
    expect(await prisma.staffVerification.count()).toBe(0);
  });

  it("refuses a code sent before they became an owner", async () => {
    const { id: marketplaceId } = await createMarketplace();
    const venue = await createVenue(marketplaceId);
    const owner = await createStaff();
    await requestReset();
    const code = outbox.lastCodeFor(PHONE) ?? "";
    await addMember(venue.id, owner.id, { role: "OWNER", permissions: permissions() });

    const res = await confirmReset(code);
    expect(res.status).toBe(400);
    expect((await json(res)).code).toBe("CODE_EXPIRED");
    expect((await signIn(PASSWORD)).status).toBe(201);
  });

  it("keeps an owner's own venue untouched even if the restriction runs", async () => {
    // Defence in depth: the reset refuses owners first, but the restriction skips them on its own.
    const { id: marketplaceId } = await createMarketplace();
    const [owned, joined] = [await createVenue(marketplaceId), await createVenue(marketplaceId)];
    const staff = await createStaff();
    await addMember(owned.id, staff.id, { role: "OWNER", permissions: permissions() });
    await addMember(joined.id, staff.id, { permissions: permissions({ bookings: "manage" }) });

    await transaction((tx) => restrictAfterPasswordReset(tx, staff.id, systemClock));

    expect((await membership(owned.id, staff.id)).permissions).toEqual(permissions());
    expect(await prisma.venueEvent.count({ where: { venueId: owned.id } })).toBe(0);
    expect((await membership(joined.id, staff.id)).permissions).toEqual(
      permissions({ bookings: "view" }),
    );
  });
});
