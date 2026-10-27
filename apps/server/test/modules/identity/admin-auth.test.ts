import { randomUUID } from "node:crypto";
import { AdminChallenge, AdminSignedIn, TotpSetup } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { createFirstAdmin } from "@/modules/identity";
import { signJwt } from "@/platform/crypto/jwt";
import { totpCode, totpStep } from "@/platform/crypto/totp";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import { mailbox } from "../../support/email";
import { createAdmin } from "../../support/factories";
import { deleteRedisKeys, resetRedis } from "../../support/redis";

const EMAIL = "omar@hagz.app";
const PASSWORD = "correct horse battery";
const ACCESS = "hagz_admin_access";
const REFRESH = "hagz_admin_refresh";

type Jar = Record<string, string>;

const request = (
  method: string,
  path: string,
  { body, jar, header = true }: { body?: unknown; jar?: Jar; header?: boolean } = {},
) =>
  router.request(`/v1${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(header && { "X-Hagz-Admin": "1" }),
      ...(jar && {
        Cookie: Object.entries(jar)
          .map(([name, value]) => `${name}=${value}`)
          .join("; "),
      }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

// The Set-Cookie headers of a response, by cookie name.
const setCookies = (res: Response) =>
  Object.fromEntries(
    res.headers.getSetCookie().map((cookie) => {
      const [pair = "", ...attributes] = cookie.split("; ");
      const [name = "", ...value] = pair.split("=");
      return [name, { value: value.join("="), attributes }];
    }),
  );
const jarFrom = (res: Response): Jar =>
  Object.fromEntries(Object.entries(setCookies(res)).map(([name, { value }]) => [name, value]));

const currentCode = (secret: string, offset = 0) => totpCode(secret, totpStep(new Date()) + offset);

const signIn = async (email = EMAIL, password = PASSWORD) => {
  const res = await request("POST", "/auth/admin/sessions", { body: { email, password } });
  expect(res.status).toBe(200);
  return AdminChallenge.parse(await res.json());
};
const complete = (challengeToken: string, code: string) =>
  request("POST", "/auth/admin/sessions/totp", { body: { challengeToken, code } });
const signedIn = async (secret: string, offset = 0) => {
  const { challengeToken } = await signIn();
  const res = await complete(challengeToken, currentCode(secret, offset));
  expect(res.status).toBe(201);
  return { res, jar: jarFrom(res) };
};

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  mailbox.sent.length = 0;
});

describe("first admin", () => {
  it("is created once, then sets up the authenticator on first sign-in", async () => {
    await createFirstAdmin({ email: " Omar@Hagz.App ", name: "Omar", password: PASSWORD });
    await expect(
      createFirstAdmin({ email: "other@hagz.app", name: "Eve", password: PASSWORD }),
    ).rejects.toThrow("Admins already exist");
    await expect(
      createFirstAdmin({ email: "not an email", name: "Eve", password: PASSWORD }),
    ).rejects.toThrow("Not an email address");

    const challenge = await signIn();
    expect(challenge.next).toBe("TOTP_SETUP");

    // No session until a code from the new authenticator is accepted.
    const early = await complete(challenge.challengeToken, "123456");
    expect((await json(early)).code).toBe("TOTP_SETUP_REQUIRED");

    const setup = await request("POST", "/auth/admin/sessions/totp-setup", {
      body: { challengeToken: challenge.challengeToken },
    });
    const { secret, otpauthUri } = TotpSetup.parse(await setup.json());
    expect(otpauthUri).toContain(encodeURIComponent("Hagz:omar@hagz.app"));
    const stored = await prisma.admin.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(stored.totpSecret).not.toContain(secret);

    const res = await complete(challenge.challengeToken, currentCode(secret));
    expect(res.status).toBe(201);
    expect(AdminSignedIn.parse(await res.json()).admin.email).toBe(EMAIL);
    expect(
      (await prisma.admin.findUniqueOrThrow({ where: { email: EMAIL } })).totpConfirmedAt,
    ).not.toBeNull();

    // Confirmed: the secret can't be swapped any more.
    const { challengeToken } = await signIn();
    const again = await request("POST", "/auth/admin/sessions/totp-setup", {
      body: { challengeToken },
    });
    expect(again.status).toBe(409);
  });
});

describe("admin sign-in", () => {
  it("answers an unknown email and a wrong password the same way", async () => {
    await createAdmin();
    const wrong = await request("POST", "/auth/admin/sessions", {
      body: { email: EMAIL, password: "not the password" },
    });
    const unknown = await request("POST", "/auth/admin/sessions", {
      body: { email: "nobody@hagz.app", password: PASSWORD },
    });
    expect(wrong.status).toBe(401);
    const strip = async (res: Response) => {
      const body = await json(res);
      delete body.requestId;
      return body;
    };
    expect(await strip(wrong)).toEqual(await strip(unknown));
  });

  it("sets httpOnly, SameSite=Strict session cookies and no tokens in the body", async () => {
    const { secret } = await createAdmin();
    const { res } = await signedIn(secret);
    const body = AdminSignedIn.parse(await res.json());
    expect(body.sessionExpiresIn).toBe(12 * 60 * 60);
    expect(JSON.stringify(body)).not.toMatch(/token/i);

    const cookies = setCookies(res);
    expect(cookies[ACCESS]?.attributes).toEqual(
      expect.arrayContaining(["Max-Age=600", "Path=/", "HttpOnly", "SameSite=Strict"]),
    );
    expect(cookies[REFRESH]?.attributes).toEqual(
      expect.arrayContaining(["Max-Age=43200", "Path=/", "HttpOnly", "SameSite=Strict"]),
    );
  });

  it("rejects a wrong code, and a right code used twice", async () => {
    const { secret } = await createAdmin();
    const first = await signIn();
    expect((await json(await complete(first.challengeToken, "000000"))).code).toBe("INVALID_CODE");
    const code = currentCode(secret);
    expect((await complete(first.challengeToken, code)).status).toBe(201);

    // Seen over a shoulder or through a phishing proxy, the same code doesn't open a second session.
    const second = await signIn();
    const replay = await complete(second.challengeToken, code);
    expect(replay.status).toBe(400);
    expect((await json(replay)).code).toBe("INVALID_CODE");
  });

  it("refuses a suspended admin after the right password", async () => {
    const { id } = await createAdmin();
    await prisma.admin.update({ where: { id }, data: { status: "SUSPENDED" } });
    const res = await request("POST", "/auth/admin/sessions", {
      body: { email: EMAIL, password: PASSWORD },
    });
    expect(res.status).toBe(403);
    expect((await json(res)).code).toBe("ACCOUNT_SUSPENDED");
  });

  it("uses each challenge once", async () => {
    const { secret } = await createAdmin();
    const { challengeToken } = await signIn();
    expect((await complete(challengeToken, currentCode(secret))).status).toBe(201);

    const reused = await complete(challengeToken, currentCode(secret, 1));
    expect(reused.status).toBe(401);
    expect((await json(reused)).code).toBe("CHALLENGE_EXPIRED");
  });

  it("doesn't accept a staff challenge or token", async () => {
    const { id, secret } = await createAdmin();
    const staffChallenge = await signJwt(
      { sub: id, sid: randomUUID() },
      { audience: "staff-challenge", ttlSeconds: 600 },
    );
    expect((await complete(staffChallenge, currentCode(secret))).status).toBe(401);

    const staffToken = await signJwt(
      { sub: id, sid: randomUUID() },
      { audience: "staff", ttlSeconds: 600 },
    );
    const me = await request("GET", "/auth/admin/me", { jar: { [ACCESS]: staffToken } });
    expect(me.status).toBe(401);
  });
});

describe("admin requests", () => {
  it("need the session cookie and the admin header", async () => {
    const { secret } = await createAdmin();
    const { jar } = await signedIn(secret);

    const me = await request("GET", "/auth/admin/me", { jar });
    expect(me.status).toBe(200);
    expect(await json(me)).toMatchObject({ email: EMAIL });

    const noHeader = await request("GET", "/auth/admin/me", { jar, header: false });
    expect(noHeader.status).toBe(403);
    expect((await json(noHeader)).code).toBe("ADMIN_HEADER_REQUIRED");
    expect((await request("GET", "/auth/admin/me")).status).toBe(401);
  });

  it("stop for a suspended admin at once", async () => {
    const { id, secret } = await createAdmin();
    const { jar } = await signedIn(secret);
    await prisma.admin.update({ where: { id }, data: { status: "SUSPENDED" } });
    expect((await request("GET", "/auth/admin/me", { jar })).status).toBe(403);
  });
});

describe("admin sessions", () => {
  it("refresh into new cookies without extending the session", async () => {
    const { id, secret } = await createAdmin();
    const { jar } = await signedIn(secret);
    const ends = new Date(Date.now() + 100_000);
    await prisma.adminSession.updateMany({ where: { adminId: id }, data: { expiresAt: ends } });

    const res = await request("POST", "/auth/admin/sessions/refresh", { body: {}, jar });
    expect(res.status).toBe(204);
    const cookies = setCookies(res);
    expect(cookies[REFRESH]?.value).not.toBe(jar[REFRESH]);
    const maxAge = Number(
      cookies[REFRESH]?.attributes.find((a) => a.startsWith("Max-Age="))?.slice(8),
    );
    expect(maxAge).toBeGreaterThan(90);
    expect(maxAge).toBeLessThanOrEqual(100);
    expect(
      (await prisma.adminSession.findFirstOrThrow({ where: { adminId: id } })).expiresAt,
    ).toEqual(ends);
  });

  it("refuse a refresh without the admin header", async () => {
    const { secret } = await createAdmin();
    const { jar } = await signedIn(secret);
    const res = await request("POST", "/auth/admin/sessions/refresh", { jar, header: false });
    expect(res.status).toBe(403);
  });

  it("revoke the session when an old refresh cookie is replayed, and clear the cookies", async () => {
    const { secret } = await createAdmin();
    const { jar } = await signedIn(secret);
    const rotated = await request("POST", "/auth/admin/sessions/refresh", { jar });
    expect(rotated.status).toBe(204);
    await deleteRedisKeys("refresh-grace:*");

    const replay = await request("POST", "/auth/admin/sessions/refresh", { jar });
    expect(replay.status).toBe(401);
    expect(setCookies(replay)[REFRESH]?.attributes).toContain("Max-Age=0");
    const current = await request("POST", "/auth/admin/sessions/refresh", {
      jar: jarFrom(rotated),
    });
    expect(current.status).toBe(401);
  });

  it("don't sign out on a forged refresh cookie", async () => {
    const { id, secret } = await createAdmin();
    const { jar } = await signedIn(secret);
    const [sessionId] = (jar[REFRESH] ?? "").split(".");

    const res = await request("DELETE", "/auth/admin/sessions/current", {
      jar: { [REFRESH]: `${sessionId ?? ""}.forged` },
    });
    expect(res.status).toBe(204);
    expect(await prisma.adminSession.count({ where: { adminId: id, revokedAt: null } })).toBe(1);
  });

  it("sign out with the refresh cookie alone", async () => {
    const { id, secret } = await createAdmin();
    const { jar } = await signedIn(secret);

    const res = await request("DELETE", "/auth/admin/sessions/current", {
      jar: { [REFRESH]: jar[REFRESH] ?? "" },
    });
    expect(res.status).toBe(204);
    expect(setCookies(res)[ACCESS]?.attributes).toContain("Max-Age=0");
    expect(await prisma.adminSession.count({ where: { adminId: id, revokedAt: null } })).toBe(0);
    expect((await request("POST", "/auth/admin/sessions/refresh", { jar })).status).toBe(401);
  });
});

describe("admin invitations", () => {
  const invite = (jar: Jar, email: string) =>
    request("POST", "/admin/invitations", { body: { email }, jar });
  const tokenFrom = (email: string) =>
    new URL(mailbox.lastInvitationTo(email)?.acceptUrl ?? "http://x").hash.replace("#token=", "");
  const accept = (token: string) =>
    request("POST", "/auth/admin/invitations/accept", {
      body: { token, name: "Sara", password: PASSWORD },
    });

  it("emails a link that creates an admin who must set up an authenticator", async () => {
    const { secret } = await createAdmin();
    const { jar } = await signedIn(secret);

    const res = await invite(jar, "Sara@Hagz.App");
    expect(res.status).toBe(201);
    expect(await json(res)).toMatchObject({ email: "sara@hagz.app" });
    const sent = mailbox.lastInvitationTo("sara@hagz.app");
    expect(sent?.invitedBy).toBe("Omar");
    // The token travels in the fragment, which browsers never send to servers.
    expect(sent?.acceptUrl).toMatch(/^http:\/\/localhost:3001\/admin\/invitations\/accept#token=/);

    const accepted = await accept(tokenFrom("sara@hagz.app"));
    expect(accepted.status).toBe(201);
    expect(AdminChallenge.parse(await accepted.json()).next).toBe("TOTP_SETUP");
    expect(await prisma.admin.count({ where: { email: "sara@hagz.app" } })).toBe(1);

    const twice = await accept(tokenFrom("sara@hagz.app"));
    expect((await json(twice)).code).toBe("INVITATION_INVALID");
  });

  it("only honours the newest link for an email, and not after it expires", async () => {
    const { secret } = await createAdmin();
    const { jar } = await signedIn(secret);
    await invite(jar, "sara@hagz.app");
    const first = tokenFrom("sara@hagz.app");
    await invite(jar, "sara@hagz.app");
    const second = tokenFrom("sara@hagz.app");

    expect((await json(await accept(first))).code).toBe("INVITATION_INVALID");
    await prisma.adminInvitation.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await json(await accept(second))).code).toBe("INVITATION_INVALID");
    expect(await prisma.admin.count()).toBe(1);
  });

  it("refuses to invite an existing admin, or anyone without an admin session", async () => {
    const { secret } = await createAdmin();
    const { jar } = await signedIn(secret);
    expect((await invite(jar, EMAIL)).status).toBe(409);
    expect((await invite({}, "sara@hagz.app")).status).toBe(401);
    expect(mailbox.sent).toHaveLength(0);
  });
});
