import {
  CustomerAuthenticated,
  Session,
  StaffAuthenticated,
  TwoFactorChallenge,
} from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { verifyJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import { createCustomer, createStaff } from "../../support/factories";
import { outbox } from "../../support/messaging";
import { resetRedis } from "../../support/redis";

// Staff sign in through the same code as customers (see customer-*.test.ts for the flows in depth).
// These tests cover what differs: their own tables, audiences and lifetimes, and that the two account
// types never accept each other's tokens.

const PHONE = "+201001234567";
const PASSWORD = "correct horse battery";

const request = (
  type: "customer" | "staff",
  method: string,
  path: string,
  body?: unknown,
  accessToken?: string,
) =>
  router.request(`/v1/auth/${type}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const staff = (method: string, path: string, body?: unknown, accessToken?: string) =>
  request("staff", method, path, body, accessToken);
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

const signInStaff = async () => {
  const res = await staff("POST", "/sessions", { phone: PHONE, password: PASSWORD });
  expect(res.status).toBe(201);
  return StaffAuthenticated.parse(await res.json());
};
const signInCustomer = async () => {
  const res = await request("customer", "POST", "/sessions", { phone: PHONE, password: PASSWORD });
  expect(res.status).toBe(201);
  return CustomerAuthenticated.parse(await res.json());
};

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  outbox.sent.length = 0;
});

describe("staff sign-up", () => {
  const verify = async (type: "customer" | "staff") => {
    expect((await request(type, "POST", "/verifications", { phone: PHONE })).status).toBe(202);
    const res = await request(type, "POST", "/verifications/confirm", {
      phone: PHONE,
      code: outbox.lastCodeFor(PHONE),
    });
    return (await json(res)).verificationToken as string;
  };

  it("creates a staff account with no venue and signs it in", async () => {
    const res = await staff(
      "POST",
      "/sign-up",
      { verificationToken: await verify("staff"), name: "Mona", password: PASSWORD },
      undefined,
    );
    expect(res.status).toBe(201);
    const body = StaffAuthenticated.parse(await res.json());
    expect(body.staff).toMatchObject({ name: "Mona", phone: PHONE });

    const account = await prisma.staff.findUniqueOrThrow({ where: { id: body.staff.id } });
    expect(account.phoneVerifiedAt).not.toBeNull();
    expect(await prisma.venueMembership.count()).toBe(0);
    expect(await prisma.customer.count()).toBe(0);
  });

  it("doesn't accept a customer's verification token", async () => {
    const token = await verify("customer");
    const res = await staff("POST", "/sign-up", {
      verificationToken: token,
      name: "Mona",
      password: PASSWORD,
    });
    expect(res.status).toBe(400);
    expect((await json(res)).code).toBe("VERIFICATION_TOKEN_INVALID");
  });

  it("lets one phone hold a customer and a staff account", async () => {
    await createCustomer({ phone: PHONE });
    const res = await staff("POST", "/sign-up", {
      verificationToken: await verify("staff"),
      name: "Mona",
      password: PASSWORD,
    });
    expect(res.status).toBe(201);
  });

  it("rejects a second staff account for the same phone", async () => {
    await createStaff({ phone: PHONE });
    const res = await staff("POST", "/sign-up", {
      verificationToken: await verify("staff"),
      name: "Mona",
      password: PASSWORD,
    });
    expect(res.status).toBe(409);
    expect((await json(res)).code).toBe("PHONE_ALREADY_REGISTERED");
  });
});

describe("staff sessions", () => {
  it("issues staff tokens that live 30 days and are stored as staff sessions", async () => {
    const { id } = await createStaff();
    const { session } = await signInStaff();

    const claims = await verifyJwt(session.accessToken, "staff");
    expect(claims.sub).toBe(id);
    expect(session.refreshTokenExpiresIn).toBe(30 * 24 * 60 * 60);
    expect(await prisma.staffSession.count({ where: { staffId: id } })).toBe(1);
    expect(await prisma.customerSession.count()).toBe(0);
  });

  it("refreshes and signs out", async () => {
    await createStaff();
    const { session } = await signInStaff();

    const refreshed = await staff("POST", "/sessions/refresh", {
      refreshToken: session.refreshToken,
    });
    expect(refreshed.status).toBe(200);
    const next = Session.parse(await refreshed.json());

    expect((await staff("DELETE", "/sessions/current", undefined, next.accessToken)).status).toBe(
      204,
    );
    const after = await staff("POST", "/sessions/refresh", { refreshToken: next.refreshToken });
    expect(after.status).toBe(401);
  });

  it("never accepts a customer's tokens, nor gives a customer's to staff routes", async () => {
    await createStaff();
    await createCustomer();
    const customer = (await signInCustomer()).session;
    const member = (await signInStaff()).session;

    // Access tokens: the audience differs.
    expect(
      (await staff("DELETE", "/sessions/current", undefined, customer.accessToken)).status,
    ).toBe(401);
    expect(
      (await request("customer", "DELETE", "/sessions/current", undefined, member.accessToken))
        .status,
    ).toBe(401);

    // Refresh tokens: the session is looked up in the other table, and isn't there.
    const crossed = await staff("POST", "/sessions/refresh", {
      refreshToken: customer.refreshToken,
    });
    expect(crossed.status).toBe(401);
    expect((await json(crossed)).code).toBe("SESSION_ENDED");
    // ...and that miss didn't revoke the customer's session.
    const own = await request("customer", "POST", "/sessions/refresh", {
      refreshToken: customer.refreshToken,
    });
    expect(own.status).toBe(200);
  });
});

describe("staff two-factor", () => {
  it("signs in with a code to the phone", async () => {
    await createStaff({ twoFactorEnabled: true });
    const res = await staff("POST", "/sessions", { phone: PHONE, password: PASSWORD });
    expect(res.status).toBe(200);
    const { challengeToken } = TwoFactorChallenge.parse(await res.json());
    expect(await prisma.staffVerification.count({ where: { purpose: "TWO_FACTOR" } })).toBe(1);

    const done = await staff("POST", "/sessions/two-factor", {
      challengeToken,
      code: outbox.lastCodeFor(PHONE),
    });
    expect(done.status).toBe(201);
    StaffAuthenticated.parse(await done.json());
  });

  it("doesn't finish a staff sign-in with a customer's challenge", async () => {
    await createStaff({ twoFactorEnabled: true });
    await createCustomer({ twoFactorEnabled: true });
    const customerChallenge = TwoFactorChallenge.parse(
      await (
        await request("customer", "POST", "/sessions", { phone: PHONE, password: PASSWORD })
      ).json(),
    );

    const res = await staff("POST", "/sessions/two-factor", {
      challengeToken: customerChallenge.challengeToken,
      code: outbox.lastCodeFor(PHONE),
    });
    expect(res.status).toBe(401);
    expect((await json(res)).code).toBe("CHALLENGE_EXPIRED");
  });
});
