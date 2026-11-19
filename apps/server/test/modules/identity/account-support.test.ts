import { randomUUID } from "node:crypto";
import { CustomerAuthenticated, type StaffPermissions } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { suspendAdmin } from "@/modules/identity/application/admin-access";
import { totpCode, totpStep } from "@/platform/crypto/totp";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import {
  addMember,
  createAdmin,
  createCustomer,
  createMarketplace,
  createStaff,
  createVenue,
} from "../../support/factories";
import { mailbox } from "../../support/email";
import { outbox } from "../../support/messaging";
import { deleteRedisKeys, resetRedis } from "../../support/redis";

// Admin support on accounts (plan 2.8): suspending customers and admins, and letting a venue owner
// reset their password once support has checked who they are. Staff suspensions are in
// venues/venue-review.test.ts.

const PHONE = "+201001234567";
const PASSWORD = "correct horse battery";
const NEW_PASSWORD = "a brand new passphrase";
const REASON = { reason: "Reported for abuse twice; confirmed on the phone." };

// Signs an admin in and returns their cookies.
const signedIn = async (email: string) => {
  const { id, secret } = await createAdmin({ email });
  const start = await router.request("/v1/auth/admin/sessions", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Hagz-Admin": "1" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const { challengeToken } = (await start.json()) as { challengeToken: string };
  const done = await router.request("/v1/auth/admin/sessions/totp", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Hagz-Admin": "1" },
    body: JSON.stringify({ challengeToken, code: totpCode(secret, totpStep(new Date())) }),
  });
  expect(done.status).toBe(201);
  const cookie = done.headers
    .getSetCookie()
    .map((c) => c.split("; ")[0])
    .join("; ");
  return { id, cookie };
};

const caller =
  ({ cookie }: { cookie: string }) =>
  (method: string, path: string, body?: unknown) =>
    router.request(`/v1${path}`, {
      method,
      headers: { "content-type": "application/json", "X-Hagz-Admin": "1", Cookie: cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

const auth = (type: "customer" | "staff", path: string, body: unknown) =>
  router.request(`/v1/auth/${type}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const code = async (res: Response) => ((await res.json()) as { code?: string }).code;

const accountEvents = () =>
  prisma.accountEvent.findMany({
    orderBy: { id: "asc" },
    select: {
      adminId: true,
      customerId: true,
      staffId: true,
      subjectAdminId: true,
      type: true,
      data: true,
    },
  });

let omar: { id: string; cookie: string };
let admin: ReturnType<typeof caller>;

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  outbox.sent.length = 0;
  outbox.supportNotices.length = 0;
  mailbox.resets.length = 0;
  omar = await signedIn("omar@hagz.app");
  admin = caller(omar);
});

describe("suspending a customer", () => {
  it("signs them out everywhere, keeps them out, and records it once", async () => {
    const customer = await createCustomer();
    const session = CustomerAuthenticated.parse(
      await (await auth("customer", "/sessions", { phone: PHONE, password: PASSWORD })).json(),
    ).session;
    await prisma.customerSession.updateMany({ data: { pushToken: "ExponentPushToken[x]" } });

    const res = await admin("POST", `/admin/customers/${customer.id}/suspend`, REASON);
    expect(res.status).toBe(204);
    expect(await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).toMatchObject({
      status: "SUSPENDED",
    });
    expect(await prisma.customerSession.count({ where: { revokedAt: null } })).toBe(0);
    expect(await prisma.customerSession.count({ where: { pushToken: { not: null } } })).toBe(0);
    // Refreshing and signing in both refuse a suspended customer.
    const refresh = await auth("customer", "/sessions/refresh", {
      refreshToken: session.refreshToken,
    });
    expect(await code(refresh)).toBe("SESSION_ENDED");
    const again = await auth("customer", "/sessions", { phone: PHONE, password: PASSWORD });
    expect(await code(again)).toBe("ACCOUNT_SUSPENDED");

    // Suspending again changes nothing.
    expect((await admin("POST", `/admin/customers/${customer.id}/suspend`, REASON)).status).toBe(
      204,
    );
    expect(await accountEvents()).toEqual([
      {
        adminId: omar.id,
        customerId: customer.id,
        staffId: null,
        subjectAdminId: null,
        type: "CUSTOMER_SUSPENDED",
        data: REASON,
      },
    ]);
  });

  it("reactivates them, so they can sign in again, once", async () => {
    const customer = await createCustomer({ status: "SUSPENDED" });

    expect((await admin("POST", `/admin/customers/${customer.id}/reactivate`)).status).toBe(204);
    expect((await admin("POST", `/admin/customers/${customer.id}/reactivate`)).status).toBe(204);
    const signIn = await auth("customer", "/sessions", { phone: PHONE, password: PASSWORD });
    expect(signIn.status).toBe(201);
    expect((await accountEvents()).map((e) => e.type)).toEqual(["CUSTOMER_REACTIVATED"]);
  });

  it("refuses a banned, deleted or unknown customer, and a reason too short", async () => {
    const banned = await createCustomer({ status: "BANNED" });
    for (const action of ["suspend", "reactivate"]) {
      const res = await admin("POST", `/admin/customers/${banned.id}/${action}`, REASON);
      expect(res.status).toBe(409);
      expect(await code(res)).toBe("ACCOUNT_BANNED");
    }
    const deleted = await createCustomer({ phone: "+201002220000" });
    await prisma.customer.update({
      where: { id: deleted.id },
      data: { phone: null, deletedAt: new Date() },
    });
    for (const id of [deleted.id, randomUUID()]) {
      const res = await admin("POST", `/admin/customers/${id}/suspend`, REASON);
      expect(res.status).toBe(404);
      expect(await code(res)).toBe("CUSTOMER_NOT_FOUND");
    }
    const short = await admin("POST", `/admin/customers/${banned.id}/suspend`, { reason: "no" });
    expect(short.status).toBe(400);
    expect(await accountEvents()).toEqual([]);
  });
});

describe("suspending an admin", () => {
  it("stops them at once, ends their sessions and their reset link, and records it", async () => {
    const sara = await signedIn("sara@hagz.app");
    await admin("POST", `/admin/list/${sara.id}/password-reset`);
    expect(mailbox.resets).toHaveLength(1);

    const res = await admin("POST", `/admin/list/${sara.id}/suspend`, REASON);
    expect(res.status).toBe(204);
    // Her access token hasn't expired, but every admin route refuses it now.
    const list = await caller(sara)("GET", "/admin/list");
    expect(list.status).toBe(403);
    expect(await code(list)).toBe("ACCOUNT_SUSPENDED");
    expect(await prisma.adminSession.count({ where: { adminId: sara.id, revokedAt: null } })).toBe(
      0,
    );
    const token = new URL(mailbox.resets[0]?.resetUrl ?? "http://x").hash.replace("#token=", "");
    await admin("POST", `/admin/list/${sara.id}/reactivate`);
    const reset = await router.request("/v1/auth/admin/password-reset", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Hagz-Admin": "1" },
      body: JSON.stringify({ token, password: NEW_PASSWORD }),
    });
    expect(await code(reset)).toBe("PASSWORD_RESET_INVALID");

    expect((await accountEvents()).map((e) => [e.adminId, e.subjectAdminId, e.type])).toEqual([
      [omar.id, sara.id, "ADMIN_PASSWORD_RESET_SENT"],
      [omar.id, sara.id, "ADMIN_SUSPENDED"],
      [omar.id, sara.id, "ADMIN_REACTIVATED"],
    ]);
    // Reactivated, the token she holds works again until it expires; her session stays ended.
    expect((await caller(sara)("GET", "/admin/list")).status).toBe(200);
  });

  it("changes nothing when suspended or reactivated again", async () => {
    const sara = await createAdmin({ email: "sara@hagz.app" });
    await admin("POST", `/admin/list/${sara.id}/suspend`, REASON);
    expect((await admin("POST", `/admin/list/${sara.id}/suspend`, REASON)).status).toBe(204);
    await admin("POST", `/admin/list/${sara.id}/reactivate`);
    expect((await admin("POST", `/admin/list/${sara.id}/reactivate`)).status).toBe(204);
    expect((await accountEvents()).map((e) => e.type)).toEqual([
      "ADMIN_SUSPENDED",
      "ADMIN_REACTIVATED",
    ]);
  });

  it("refuses your own account, a banned admin and an unknown one", async () => {
    for (const action of ["suspend", "reactivate"]) {
      const own = await admin("POST", `/admin/list/${omar.id}/${action}`, REASON);
      expect(own.status).toBe(409);
      expect(await code(own)).toBe("OWN_ADMIN_ACCOUNT");
    }
    const sara = await createAdmin({ email: "sara@hagz.app" });
    await prisma.admin.update({ where: { id: sara.id }, data: { status: "BANNED" } });
    expect(await code(await admin("POST", `/admin/list/${sara.id}/suspend`, REASON))).toBe(
      "ACCOUNT_BANNED",
    );
    expect(await code(await admin("POST", `/admin/list/${sara.id}/reactivate`))).toBe(
      "ACCOUNT_BANNED",
    );
    const missing = await admin("POST", `/admin/list/${randomUUID()}/suspend`, REASON);
    expect(missing.status).toBe(404);
    expect(await accountEvents()).toEqual([]);
  });

  it("always keeps an active admin, even when two suspend each other at once", async () => {
    const sara = await signedIn("sara@hagz.app");
    const results = await Promise.all([
      admin("POST", `/admin/list/${sara.id}/suspend`, REASON),
      caller(sara)("POST", `/admin/list/${omar.id}/suspend`, REASON),
    ]);

    const statuses = results.map((res) => res.status).sort();
    // The second either waited for the first and found the other the last active admin, or
    // arrived after it and was turned away as suspended.
    expect(statuses[0]).toBe(204);
    expect([403, 409]).toContain(statuses[1]);
    expect(await prisma.admin.count({ where: { status: "ACTIVE" } })).toBe(1);
    expect(await accountEvents()).toHaveLength(1);
  });

  it("refuses to suspend the last active admin", async () => {
    // Only reachable in a race (above), and requireAdmin turns a suspended admin away first, so the
    // rule is checked where it lives: Omar was suspended while his request to suspend Sara waited.
    const sara = await createAdmin({ email: "sara@hagz.app" });
    await prisma.admin.update({ where: { id: omar.id }, data: { status: "SUSPENDED" } });
    await expect(suspendAdmin({ adminId: sara.id, by: omar.id }, REASON)).rejects.toMatchObject({
      code: "LAST_ACTIVE_ADMIN",
    });
    expect(await prisma.admin.count({ where: { status: "ACTIVE" } })).toBe(1);
  });

  it("turns away an admin suspended while their request waited", async () => {
    const sara = await createAdmin({ email: "sara@hagz.app" });
    await createAdmin({ email: "ali@hagz.app" });
    await prisma.admin.update({ where: { id: omar.id }, data: { status: "SUSPENDED" } });
    await expect(suspendAdmin({ adminId: sara.id, by: omar.id }, REASON)).rejects.toMatchObject({
      code: "ACCOUNT_SUSPENDED",
    });
    expect(await prisma.admin.count({ where: { status: "ACTIVE" } })).toBe(2);
  });
});

describe("a password reset support lets an owner do", () => {
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

  // An owner of one venue who is also a member of another.
  const anOwner = async () => {
    const { id: marketplaceId } = await createMarketplace();
    const [owned, joined] = [await createVenue(marketplaceId), await createVenue(marketplaceId)];
    const owner = await createStaff();
    await addMember(owned.id, owner.id, { role: "OWNER", permissions: permissions() });
    await addMember(joined.id, owner.id, { permissions: permissions({ bookings: "manage" }) });
    return { owner, owned, joined };
  };

  // The app's forgot-password flow: request a code, verify it, set the password.
  const resetByPhone = async () => {
    expect((await auth("staff", "/password-resets", { phone: PHONE })).status).toBe(202);
    const verified = await auth("staff", "/password-resets/verify", {
      phone: PHONE,
      code: outbox.lastCodeFor(PHONE) ?? "000000",
    });
    if (verified.status !== 200) return verified;
    const { resetToken } = (await verified.json()) as { resetToken: string };
    return auth("staff", "/password-resets/confirm", { resetToken, newPassword: NEW_PASSWORD });
  };

  it("lets them reset once by phone, keeping every venue and permission", async () => {
    const { owner, owned, joined } = await anOwner();
    const grant = await admin("POST", `/admin/staff/${owner.id}/password-reset`, REASON);
    expect(grant.status).toBe(204);

    expect((await resetByPhone()).status).toBe(204);
    expect(outbox.supportNotices).toHaveLength(0);
    const signIn = await auth("staff", "/sessions", { phone: PHONE, password: NEW_PASSWORD });
    expect(signIn.status).toBe(201);
    const memberships = await prisma.venueMembership.findMany({
      where: { staffId: owner.id },
      select: { venueId: true, role: true, permissions: true },
    });
    expect(memberships).toEqual(
      expect.arrayContaining([
        { venueId: owned.id, role: "OWNER", permissions: permissions() },
        { venueId: joined.id, role: "MEMBER", permissions: permissions({ bookings: "manage" }) },
      ]),
    );
    expect(await prisma.venueEvent.count()).toBe(0);
    expect(await accountEvents()).toEqual([
      {
        adminId: omar.id,
        customerId: null,
        staffId: owner.id,
        subjectAdminId: null,
        type: "STAFF_PASSWORD_RESET_GRANTED",
        data: REASON,
      },
    ]);

    // Used: the next attempt goes back to support, as before.
    await deleteRedisKeys("ratelimit:*");
    outbox.sent.length = 0;
    const again = await resetByPhone();
    expect(await code(again)).toBe("CODE_EXPIRED");
    expect(outbox.supportNotices).toHaveLength(1);
  });

  it("lets only one of two resets started while it stood through", async () => {
    const { owner } = await anOwner();
    await admin("POST", `/admin/staff/${owner.id}/password-reset`, REASON);
    const tokens = [];
    for (const proof of [1, 2]) {
      // Past the resend cooldown, keeping the grant.
      await deleteRedisKeys("ratelimit:*");
      expect((await auth("staff", "/password-resets", { phone: PHONE })).status).toBe(202);
      const verified = await auth("staff", "/password-resets/verify", {
        phone: PHONE,
        code: outbox.lastCodeFor(PHONE),
      });
      expect(verified.status, `verification ${proof}`).toBe(200);
      tokens.push(((await verified.json()) as { resetToken: string }).resetToken);
    }
    const confirm = (resetToken: string | undefined) =>
      auth("staff", "/password-resets/confirm", { resetToken, newPassword: NEW_PASSWORD });
    expect((await confirm(tokens[0])).status).toBe(204);
    expect(await code(await confirm(tokens[1]))).toBe("RESET_TOKEN_INVALID");
  });

  it("refuses an account that isn't active, or doesn't exist", async () => {
    const { owner } = await anOwner();
    await prisma.staff.update({ where: { id: owner.id }, data: { status: "SUSPENDED" } });
    const suspended = await admin("POST", `/admin/staff/${owner.id}/password-reset`, REASON);
    expect(suspended.status).toBe(409);
    expect(await suspended.json()).toMatchObject({
      code: "STAFF_NOT_ACTIVE",
      staffStatus: "SUSPENDED",
    });
    const missing = await admin("POST", `/admin/staff/${randomUUID()}/password-reset`, REASON);
    expect(await code(missing)).toBe("STAFF_NOT_FOUND");
    expect(await accountEvents()).toEqual([]);
  });
});
