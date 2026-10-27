import { CustomerAuthenticated, TwoFactorChallenge } from "@hagz/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "@/http/router";
import { verifyJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import { createCustomer } from "../../support/factories";
import { outbox } from "../../support/messaging";
import { deleteRedisKeys, resetRedis } from "../../support/redis";

const PHONE = "+201001234567";
const PASSWORD = "correct horse battery";
const NEW_PASSWORD = "a brand new passphrase";

const request = async (method: string, path: string, body?: unknown, accessToken?: string) =>
  router.request(`/v1/auth/customer${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;
const withoutRequestId = async (res: Response) => {
  const body = await json(res);
  delete body.requestId;
  return body;
};

const signIn = (password = PASSWORD) => request("POST", "/sessions", { phone: PHONE, password });
const lastCode = () => outbox.lastCodeFor(PHONE) ?? "";
// Lets a test send another code without waiting out the one-minute cooldown.
const skipCooldown = async () => {
  await deleteRedisKeys("ratelimit:account-code:*");
  await prisma.customerVerification.updateMany({
    data: { createdAt: new Date(Date.now() - 120_000) },
  });
};

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetDatabase();
  await resetRedis();
  outbox.sent.length = 0;
});

describe("password reset", () => {
  const requestReset = (phone = PHONE) => request("POST", "/password-resets", { phone });
  const confirmReset = (code: string, phone = PHONE) =>
    request("POST", "/password-resets/confirm", { phone, code, newPassword: NEW_PASSWORD });

  it("sets the new password and signs out every session", async () => {
    await createCustomer({ language: "EN" });
    const sessions = await Promise.all([signIn(), signIn()]);
    const refreshTokens = await Promise.all(
      sessions.map(
        async (res) => CustomerAuthenticated.parse(await res.json()).session.refreshToken,
      ),
    );

    expect((await requestReset()).status).toBe(202);
    expect(outbox.sent.at(-1)).toMatchObject({ phone: PHONE, language: "EN" }); // the account's language
    expect((await confirmReset(lastCode())).status).toBe(204);

    expect((await signIn(PASSWORD)).status).toBe(401);
    expect((await signIn(NEW_PASSWORD)).status).toBe(201);
    for (const refreshToken of refreshTokens) {
      expect((await request("POST", "/sessions/refresh", { refreshToken })).status).toBe(401);
    }
  });

  it("answers unknown and suspended numbers exactly like a registered one, sending nothing", async () => {
    await createCustomer();
    await createCustomer({ phone: "+201005555555", status: "SUSPENDED" });

    const registered = await withoutRequestId(await requestReset());
    const unknown = await withoutRequestId(await requestReset("+201009999999"));
    const suspended = await withoutRequestId(await requestReset("+201005555555"));

    expect(unknown).toEqual(registered);
    expect(suspended).toEqual(registered);
    expect(outbox.sent.map((m) => m.phone)).toEqual([PHONE]);
  });

  it("applies the cooldown to every number alike", async () => {
    await createCustomer();
    await requestReset();
    await requestReset("+201009999999");

    expect((await requestReset()).status).toBe(429);
    expect((await requestReset("+201009999999")).status).toBe(429);
  });

  it("accepts a code once, burns it after five wrong guesses, and expires it", async () => {
    await createCustomer();
    await requestReset();
    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";

    expect(await json(await confirmReset(wrong))).toMatchObject({
      code: "INVALID_CODE",
      attemptsLeft: 4,
    });
    expect((await confirmReset(code)).status).toBe(204);
    expect(await json(await confirmReset(code))).toMatchObject({ code: "CODE_EXPIRED" });

    await skipCooldown();
    await requestReset();
    for (let i = 0; i < 5; i++) await confirmReset(wrong);
    expect(await json(await confirmReset(lastCode()))).toMatchObject({ code: "CODE_EXPIRED" });

    await skipCooldown();
    await requestReset();
    await prisma.customerVerification.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await json(await confirmReset(lastCode()))).toMatchObject({ code: "CODE_EXPIRED" });
  });

  it("counts simultaneous wrong guesses, so they can't get past the limit", async () => {
    await createCustomer();
    await requestReset();
    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";

    await Promise.all(Array.from({ length: 10 }, () => confirmReset(wrong)));

    expect(await json(await confirmReset(code))).toMatchObject({ code: "CODE_EXPIRED" });
  });

  it("replaces the previous code with a new one", async () => {
    await createCustomer();
    await requestReset();
    const first = lastCode();
    await skipCooldown();
    await requestReset();
    const second = lastCode();
    if (first === second) return; // 1 in a million: the same digits again

    // The old code is checked against the new one, so it's simply wrong (and costs an attempt).
    expect(await json(await confirmReset(first))).toMatchObject({
      code: "INVALID_CODE",
      attemptsLeft: 4,
    });
    expect((await confirmReset(second)).status).toBe(204);
  });

  it("treats a number without an account like a wrong code", async () => {
    const res = await confirmReset("123456", "+201009999999");
    expect(await json(res)).toMatchObject({ code: "CODE_EXPIRED" });
  });
});

describe("two-factor", () => {
  const signedInAs = async () => CustomerAuthenticated.parse(await (await signIn()).json());
  const setTwoFactor = async (accessToken: string, enabled: boolean) => {
    expect((await request("POST", "/two-factor/codes", undefined, accessToken)).status).toBe(202);
    return request("PUT", "/two-factor", { enabled, code: lastCode() }, accessToken);
  };
  const challenge = async () => {
    const res = await signIn();
    expect(res.status).toBe(200);
    return TwoFactorChallenge.parse(await res.json());
  };
  const complete = (challengeToken: string, code: string) =>
    request("POST", "/sessions/two-factor", { challengeToken, code });

  it("turns on with a code, then sign-in needs the code too", async () => {
    const { id } = await createCustomer();
    const { session } = await signedInAs();

    const res = await setTwoFactor(session.accessToken, true);
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ enabled: true });
    await skipCooldown();

    const { challengeToken } = await challenge();
    const done = await complete(challengeToken, lastCode());
    expect(done.status).toBe(201);
    const { session: second } = CustomerAuthenticated.parse(await done.json());
    expect(await verifyJwt(second.accessToken, "customer")).toMatchObject({ sub: id });
  });

  it("needs a right code to change the setting", async () => {
    await createCustomer();
    const { session } = await signedInAs();
    await request("POST", "/two-factor/codes", undefined, session.accessToken);
    const wrong = lastCode() === "000000" ? "111111" : "000000";

    expect(
      (await request("PUT", "/two-factor", { enabled: true, code: wrong }, session.accessToken))
        .status,
    ).toBe(400);
    expect((await request("PUT", "/two-factor", { enabled: true, code: lastCode() })).status).toBe(
      401,
    );
    expect((await prisma.customer.findFirstOrThrow()).twoFactorEnabled).toBe(false);
  });

  it("sends nothing for a wrong password", async () => {
    await createCustomer({ twoFactorEnabled: true });

    expect((await signIn("wrong")).status).toBe(401);
    expect(outbox.sent).toHaveLength(0);
  });

  it("binds each challenge to its own code", async () => {
    await createCustomer({ twoFactorEnabled: true });
    const first = await challenge();
    await skipCooldown();

    const resent = await request("POST", "/sessions/two-factor/resend", {
      challengeToken: first.challengeToken,
    });
    expect(resent.status).toBe(202);
    const second = TwoFactorChallenge.parse(await resent.json());

    expect(await json(await complete(first.challengeToken, lastCode()))).toMatchObject({
      code: "CODE_EXPIRED",
    });
    expect((await complete(second.challengeToken, lastCode())).status).toBe(201);
  });

  it("keeps challenge tokens and access tokens apart", async () => {
    await createCustomer({ twoFactorEnabled: true });
    const { challengeToken } = await challenge();
    await prisma.customer.updateMany({ data: { twoFactorEnabled: false } });
    const { session } = await signedInAs();

    expect((await request("DELETE", "/sessions/current", undefined, challengeToken)).status).toBe(
      401,
    );
    expect(await json(await complete(session.accessToken, "123456"))).toMatchObject({
      code: "CHALLENGE_EXPIRED",
    });
  });

  it("doesn't let a password reset code finish a two-factor sign-in", async () => {
    await createCustomer({ twoFactorEnabled: true });
    const { challengeToken } = await challenge();
    await skipCooldown();
    await request("POST", "/password-resets", { phone: PHONE });
    const resetCode = lastCode();

    const res = await complete(challengeToken, resetCode);

    expect(res.status).toBe(400);
  });

  it("doesn't accept a two-factor code as a password reset code", async () => {
    await createCustomer();
    const { session } = await signedInAs();
    await request("POST", "/two-factor/codes", undefined, session.accessToken);
    const twoFactorCode = lastCode();

    const res = await request("POST", "/password-resets/confirm", {
      phone: PHONE,
      code: twoFactorCode,
      newPassword: NEW_PASSWORD,
    });

    expect(await json(res)).toMatchObject({ code: "CODE_EXPIRED" });
    expect((await signIn(PASSWORD)).status).toBe(201);
  });

  it("turns off with a code", async () => {
    await createCustomer({ twoFactorEnabled: true });
    const { challengeToken } = await challenge();
    const { session } = CustomerAuthenticated.parse(
      await (await complete(challengeToken, lastCode())).json(),
    );
    await skipCooldown();

    expect(await json(await setTwoFactor(session.accessToken, false))).toEqual({ enabled: false });
    expect((await signIn()).status).toBe(201);
  });
});
