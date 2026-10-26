import { CustomerSignedUp } from "@hagz/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "@/http/router";
import { verifyJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import { messaging } from "@/platform/messaging/messaging";
import { queueConnection } from "@/platform/redis/connections";
import { resetDatabase } from "../../support/database";
import { createMarketplace, createVenue } from "../../support/factories";
import { outbox } from "../../support/messaging";
import { deleteRedisKeys } from "../../support/redis";

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  router.request(`/v1/auth/customer${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

const sendCode = (phone: string, headers?: Record<string, string>) =>
  post("/verifications", { phone }, headers);
const confirm = (phone: string, code: string) => post("/verifications/confirm", { phone, code });
const signUp = (
  verificationToken: string,
  overrides: Record<string, unknown> = {},
  headers?: Record<string, string>,
) =>
  post(
    "/sign-up",
    {
      verificationToken,
      name: "Ahmed",
      password: "correct horse battery",
      timezone: "Africa/Cairo",
      ...overrides,
    },
    headers,
  );

// Sends a code, reads it from the outbox like the user would, and returns the verification token.
const verify = async (phone: string) => {
  expect((await sendCode(phone)).status).toBe(202);
  const code = outbox.lastCodeFor(phone);
  if (!code) throw new Error(`No code sent to ${phone}`);
  const res = await confirm(phone, code);
  expect(res.status).toBe(200);
  return (await json(res)).verificationToken as string;
};

let marketplaceId: string;
beforeEach(async () => {
  vi.restoreAllMocks();
  await resetDatabase();
  await deleteRedisKeys("otp:*", "ratelimit:otp:*");
  outbox.sent.length = 0;
  marketplaceId = (await createMarketplace({ code: "EG" })).id;
  await prisma.marketplace.update({ where: { id: marketplaceId }, data: { dialCode: "+20" } });
});

describe("customer sign-up", () => {
  it("verifies the phone, creates the account and signs in", async () => {
    const token = await verify("+201001234567");

    const res = await signUp(token, { timezone: "Africa/Cairo" }, { "Accept-Language": "en" });

    expect(res.status).toBe(201);
    const { customer, session } = CustomerSignedUp.parse(await res.json());
    expect(customer).toMatchObject({ name: "Ahmed", phone: "+201001234567", language: "EN" });
    expect(await verifyJwt(session.accessToken, "customer")).toMatchObject({ sub: customer.id });

    const stored = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
      include: { sessions: true },
    });
    expect(stored.phoneVerifiedAt).not.toBeNull();
    expect(stored.timezone).toBe("Africa/Cairo");
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.sessions).toHaveLength(1);
    // Only a hash of the refresh secret is stored.
    expect(session.refreshToken).toMatch(new RegExp(`^${stored.sessions[0]?.id}\\.`));
    expect(stored.sessions[0]?.refreshTokenHash).not.toContain(session.refreshToken.split(".")[1]);
  });

  it("sends codes in the requested language and accepts any formatting of the number", async () => {
    expect((await sendCode("+20 (100) 123-4567", { "Accept-Language": "ar" })).status).toBe(202);

    expect(outbox.sent).toEqual([
      expect.objectContaining({ phone: "+201001234567", language: "AR" }),
    ]);
    expect((await confirm("+201001234567", outbox.lastCodeFor("+201001234567") ?? "")).status).toBe(
      200,
    );
  });

  it("links the venues' walk-in records for the phone to the new account", async () => {
    const venue = await createVenue(marketplaceId);
    const walkIn = await prisma.venueCustomer.create({
      data: { venueId: venue.id, name: "Ahmed (walk-in)", phone: "+201001234567" },
    });
    const stranger = await prisma.venueCustomer.create({
      data: { venueId: venue.id, name: "Someone", phone: "+201009999999" },
    });

    const { customer } = CustomerSignedUp.parse(
      await (await signUp(await verify("+201001234567"))).json(),
    );

    expect(
      (await prisma.venueCustomer.findUniqueOrThrow({ where: { id: walkIn.id } })).customerId,
    ).toBe(customer.id);
    expect(
      (await prisma.venueCustomer.findUniqueOrThrow({ where: { id: stranger.id } })).customerId,
    ).toBeNull();
  });

  it("answers a registered number the same way, and refuses a second account at sign-up", async () => {
    await signUp(await verify("+201001234567"));
    await deleteRedisKeys("otp:*"); // skip the resend cooldown

    const res = await sendCode("+201001234567");
    expect(res.status).toBe(202);
    expect(await json(res)).toEqual({ expiresIn: 600, resendAfter: 60 });

    const second = await signUp(
      await (async () => {
        const code = outbox.lastCodeFor("+201001234567") ?? "";
        return (await json(await confirm("+201001234567", code))).verificationToken as string;
      })(),
    );
    expect(second.status).toBe(409);
    expect(await json(second)).toMatchObject({ code: "PHONE_ALREADY_REGISTERED" });
  });

  it("makes the user wait before sending another code", async () => {
    await sendCode("+201001234567");

    const res = await sendCode("+201001234567");

    expect(res.status).toBe(429);
    expect(await json(res)).toMatchObject({ code: "RATE_LIMITED" });
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(outbox.sent).toHaveLength(1);
  });

  it("burns a code after five wrong guesses", async () => {
    await sendCode("+201001234567");
    const right = outbox.lastCodeFor("+201001234567") ?? "";
    const wrong = right === "000000" ? "111111" : "000000";

    const first = await confirm("+201001234567", wrong);
    expect(first.status).toBe(400);
    expect(await json(first)).toMatchObject({ code: "INVALID_CODE", attemptsLeft: 4 });
    for (let i = 0; i < 3; i++) await confirm("+201001234567", wrong);
    expect(await json(await confirm("+201001234567", wrong))).toMatchObject({
      code: "CODE_EXPIRED",
    });

    expect(await json(await confirm("+201001234567", right))).toMatchObject({
      code: "CODE_EXPIRED",
    });
  });

  it("accepts a code only once", async () => {
    await sendCode("+201001234567");
    const code = outbox.lastCodeFor("+201001234567") ?? "";

    expect((await confirm("+201001234567", code)).status).toBe(200);
    expect(await json(await confirm("+201001234567", code))).toMatchObject({
      code: "CODE_EXPIRED",
    });
  });

  it("accepts a verification token only once", async () => {
    const token = await verify("+201001234567");
    expect((await signUp(token)).status).toBe(201);

    const again = await signUp(token);

    expect(again.status).toBe(400);
    expect(await json(again)).toMatchObject({ code: "VERIFICATION_TOKEN_INVALID" });
  });

  it("creates one account when the same sign-up races", async () => {
    const token = await verify("+201001234567");

    const statuses = (await Promise.all([signUp(token), signUp(token), signUp(token)])).map(
      (res) => res.status,
    );

    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s !== 201).every((s) => s === 409 || s === 400)).toBe(true);
    expect(await prisma.customer.count()).toBe(1);
  });

  it("keeps the token usable when sign-up input is invalid", async () => {
    const token = await verify("+201001234567");

    const badZone = await signUp(token, { timezone: "Mars/Olympus_Mons" });
    expect(badZone.status).toBe(400);
    expect(await json(badZone)).toMatchObject({
      code: "VALIDATION_FAILED",
      errors: [expect.objectContaining({ path: "timezone" })],
    });
    expect((await signUp(token, { password: "short" })).status).toBe(400);

    expect((await signUp(token)).status).toBe(201);
  });

  it("keeps the token usable when the database fails mid sign-up, so a retry works", async () => {
    const token = await verify("+201001234567");
    // The shape Prisma gives a connection that dies under a query.
    const dropped = Object.assign(new Error("Server has closed the connection."), {
      code: "P1017",
    });
    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(dropped);

    expect((await signUp(token)).status).toBe(503);

    expect((await signUp(token)).status).toBe(201);
  });

  it("rejects numbers that aren't mobiles in international format", async () => {
    for (const phone of ["+20223456789", "01001234567"]) {
      const res = await sendCode(phone);
      expect(res.status).toBe(400);
      expect(await json(res)).toMatchObject({ code: "INVALID_PHONE_NUMBER" });
    }
    expect(outbox.sent).toHaveLength(0);
  });

  it("doesn't make the user wait when the code couldn't be sent", async () => {
    vi.spyOn(messaging, "sendVerificationCode").mockRejectedValueOnce(new Error("provider down"));
    expect((await sendCode("+201001234567")).status).toBe(500);

    expect((await sendCode("+201001234567")).status).toBe(202);
  });

  it("keeps phones and codes out of Redis", async () => {
    await sendCode("+201001234567");
    const code = outbox.lastCodeFor("+201001234567") ?? "";

    const keys = await queueConnection.keys("otp:*");
    const values = await Promise.all(
      keys.map(async (key) => JSON.stringify(await queueConnection.hgetall(key).catch(() => ({})))),
    );
    expect(keys.join(" ")).not.toContain("1001234567");
    expect(values.join(" ")).not.toContain(code);
  });
});
