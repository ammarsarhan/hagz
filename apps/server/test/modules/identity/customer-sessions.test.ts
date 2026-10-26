import { CustomerAuthenticated, Session } from "@hagz/contracts";
import { hash } from "@node-rs/argon2";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "@/http/router";
import { signJwt, verifyJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import { queueConnection } from "@/platform/redis/connections";
import { resetDatabase } from "../../support/database";
import { createCustomer } from "../../support/factories";
import { deleteRedisKeys } from "../../support/redis";

const PHONE = "+201001234567";
const PASSWORD = "correct horse battery";

const request = (
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  router.request(`/v1/auth/customer${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

const signIn = (phone = PHONE, password = PASSWORD) =>
  request("POST", "/sessions", { phone, password });
const refresh = (refreshToken: string) => request("POST", "/sessions/refresh", { refreshToken });
const signOut = (accessToken: string) =>
  request("DELETE", "/sessions/current", undefined, { Authorization: `Bearer ${accessToken}` });

const signedIn = async () => {
  const res = await signIn();
  expect(res.status).toBe(201);
  return CustomerAuthenticated.parse(await res.json());
};
const refreshed = async (refreshToken: string) => {
  const res = await refresh(refreshToken);
  expect(res.status).toBe(200);
  return Session.parse(await res.json());
};
const expectEnded = async (res: Response) => {
  expect(res.status).toBe(401);
  expect(await json(res)).toMatchObject({ code: "SESSION_ENDED" });
};

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetDatabase();
  await deleteRedisKeys("ratelimit:sign-in:*", "refresh-grace:*");
});

describe("sign in", () => {
  it("returns a session for the right password, however the number is formatted", async () => {
    const { id } = await createCustomer();

    const res = await signIn("+20 100 123 4567");

    expect(res.status).toBe(201);
    const { customer, session } = CustomerAuthenticated.parse(await res.json());
    expect(customer).toMatchObject({ id, phone: PHONE });
    expect(await verifyJwt(session.accessToken, "customer")).toMatchObject({ sub: id });
    expect((await prisma.customer.findUniqueOrThrow({ where: { id } })).lastLoginAt).not.toBeNull();
  });

  it("answers an unknown number, a malformed one and a wrong password identically", async () => {
    await createCustomer();
    const bodies = [];
    for (const res of [
      await signIn(PHONE, "wrong"),
      await signIn("+201009999999"),
      await signIn("not a phone"),
    ]) {
      expect(res.status).toBe(401);
      const body = await json(res);
      delete body.requestId; // differs per request by design
      bodies.push(body);
    }
    expect(bodies[0]).toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
  });

  it("says an account is suspended only after the right password", async () => {
    await createCustomer({ status: "SUSPENDED" });

    expect((await signIn(PHONE, "wrong")).status).toBe(401);
    const res = await signIn();
    expect(res.status).toBe(403);
    expect(await json(res)).toMatchObject({ code: "ACCOUNT_SUSPENDED" });
  });

  it("upgrades a password hashed under an older policy", async () => {
    const { id } = await createCustomer({
      passwordHash: await hash(PASSWORD, { memoryCost: 4096, timeCost: 2, parallelism: 1 }),
    });

    await signedIn();

    expect((await prisma.customer.findUniqueOrThrow({ where: { id } })).passwordHash).toMatch(
      /m=19456,t=2,p=1/,
    );
  });

  it("limits password guesses per number", async () => {
    await createCustomer();
    for (let i = 0; i < 10; i++) await signIn(PHONE, "wrong");

    const res = await signIn();

    expect(res.status).toBe(429);
  });
});

describe("refresh", () => {
  beforeEach(async () => {
    await createCustomer();
  });

  it("rotates the refresh token and extends the session", async () => {
    const { session } = await signedIn();
    const before = await prisma.customerSession.findFirstOrThrow();

    const next = await refreshed(session.refreshToken);

    expect(next.refreshToken).not.toBe(session.refreshToken);
    expect(next.refreshToken.split(".")[0]).toBe(session.refreshToken.split(".")[0]);
    const after = await prisma.customerSession.findFirstOrThrow();
    expect(after.refreshTokenHash).not.toBe(before.refreshTokenHash);
    expect(after.expiresAt.getTime()).toBeGreaterThanOrEqual(before.expiresAt.getTime());
    await expect(refreshed(next.refreshToken)).resolves.toBeDefined();
  });

  it("answers the previous token with the same new one for a short while", async () => {
    const { session } = await signedIn();
    const next = await refreshed(session.refreshToken);

    const retried = await refreshed(session.refreshToken);

    expect(retried.refreshToken).toBe(next.refreshToken);
  });

  it("gives concurrent refreshes the same token and keeps the session", async () => {
    const { session } = await signedIn();
    // Hold the first refresh inside its transaction (while it writes the grace entry), so the others
    // really arrive while it's in flight instead of happening to run one after another.
    const set = queueConnection.set.bind(queueConnection);
    vi.spyOn(queueConnection, "set").mockImplementation(async (...args: Parameters<typeof set>) => {
      if (String(args[0]).startsWith("refresh-grace:"))
        await new Promise((resolve) => setTimeout(resolve, 200));
      return set(...args);
    });

    const results = await Promise.all(
      Array.from({ length: 5 }, () => refreshed(session.refreshToken)),
    );

    expect(new Set(results.map((r) => r.refreshToken)).size).toBe(1);
    vi.restoreAllMocks();
    await expect(refreshed(results[0]?.refreshToken ?? "")).resolves.toBeDefined();
  });

  it("revokes the whole session when an old token is reused after the grace window", async () => {
    const { session } = await signedIn();
    const stolenCopy = session.refreshToken;
    const legitimate = await refreshed(session.refreshToken);
    await deleteRedisKeys("refresh-grace:*"); // the 30 s window has passed

    await expectEnded(await refresh(stolenCopy));

    // The legitimate holder's newer token dies with it: the thief may be the one holding it.
    await expectEnded(await refresh(legitimate.refreshToken));
    expect((await prisma.customerSession.findFirstOrThrow()).revokedAt).not.toBeNull();
  });

  it.each([
    ["garbage"],
    ["not-a-uuid.secret"],
    ["0190a000-0000-7000-8000-000000000001.a.b"],
    ["0190a000-0000-7000-8000-000000000001.unknown"],
  ])("rejects %j cleanly, not with a 500", async (token) => {
    await expectEnded(await refresh(token));
  });

  it("ends expired sessions and suspended accounts", async () => {
    const first = await signedIn();
    await prisma.customerSession.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expectEnded(await refresh(first.session.refreshToken));

    const second = await signedIn();
    await prisma.customer.updateMany({ data: { status: "SUSPENDED" } });
    await expectEnded(await refresh(second.session.refreshToken));
  });

  it("never revokes because Redis is unreachable", async () => {
    const { session } = await signedIn();
    const next = await refreshed(session.refreshToken);
    vi.spyOn(queueConnection, "get").mockReturnValue(new Promise(() => undefined));

    const res = await refresh(session.refreshToken);

    expect(res.status).toBe(503);
    vi.restoreAllMocks();
    expect((await prisma.customerSession.findFirstOrThrow()).revokedAt).toBeNull();
    await expect(refreshed(next.refreshToken)).resolves.toBeDefined();
  });
});

describe("sign out", () => {
  beforeEach(async () => {
    await createCustomer();
  });

  it("ends the session's refresh token at once, and repeating it is harmless", async () => {
    const { session } = await signedIn();

    expect((await signOut(session.accessToken)).status).toBe(204);

    await expectEnded(await refresh(session.refreshToken));
    expect((await signOut(session.accessToken)).status).toBe(204);
  });

  it("needs a customer access token", async () => {
    const missing = await request("DELETE", "/sessions/current");
    expect(missing.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toBe("Bearer");

    const staffToken = await signJwt(
      { sub: "x", sid: "y" },
      { audience: "staff", ttlSeconds: 600 },
    );
    expect((await signOut(staffToken)).status).toBe(401);
  });
});
