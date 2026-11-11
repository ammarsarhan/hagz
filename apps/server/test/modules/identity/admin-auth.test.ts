import { randomUUID } from "node:crypto";
import { AdminChallenge, AdminDetails, AdminSignedIn, TotpSetup } from "@hagz/contracts";
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
  mailbox.resets.length = 0;
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

  it("end the browser's previous session when it signs in again, but only once that succeeds", async () => {
    const { id, secret } = await createAdmin();
    const { jar: first } = await signedIn(secret, -1);

    // A failed second sign-in leaves the first session alone.
    const { challengeToken: wrong } = await signIn();
    const failed = await request("POST", "/auth/admin/sessions/totp", {
      body: { challengeToken: wrong, code: "000000" },
      jar: first,
    });
    expect(failed.status).not.toBe(201);
    expect(await prisma.adminSession.count({ where: { adminId: id, revokedAt: null } })).toBe(1);

    const { challengeToken } = await signIn();
    const again = await request("POST", "/auth/admin/sessions/totp", {
      body: { challengeToken, code: currentCode(secret) },
      jar: first,
    });
    expect(again.status).toBe(201);
    expect(await prisma.adminSession.count({ where: { adminId: id, revokedAt: null } })).toBe(1);
    expect((await request("POST", "/auth/admin/sessions/refresh", { jar: first })).status).toBe(
      401,
    );
    expect(
      (await request("POST", "/auth/admin/sessions/refresh", { jar: jarFrom(again) })).status,
    ).toBe(204);
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

  it("lists every admin, oldest first, with their access", async () => {
    const { secret } = await createAdmin();
    const { jar } = await signedIn(secret);
    await invite(jar, "sara@hagz.app");
    await accept(tokenFrom("sara@hagz.app"));
    await createAdmin({ email: "ali@hagz.app" });
    await prisma.admin.updateMany({
      where: { email: "ali@hagz.app" },
      data: { status: "SUSPENDED" },
    });

    const res = await request("GET", "/admin/list", { jar });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: Record<string, unknown>[] };
    expect(data.map((a) => [a.email, a.status, a.authenticatorSetUp])).toEqual([
      ["omar@hagz.app", "ACTIVE", true],
      ["sara@hagz.app", "ACTIVE", false],
      ["ali@hagz.app", "SUSPENDED", true],
    ]);
    expect(data[0]?.lastSignedInAt).toEqual(expect.any(String));
    expect(data[1]?.lastSignedInAt).toBeNull();
    expect(Object.keys(data[0] ?? {}).sort()).toEqual([
      "authenticatorSetUp",
      "createdAt",
      "email",
      "id",
      "lastSignedInAt",
      "name",
      "status",
    ]);

    expect((await request("GET", "/admin/list", { jar: {} })).status).toBe(401);
    expect((await request("GET", "/admin/list", { jar, header: false })).status).toBe(403);
  });

  it("lists open invitations and revokes them", async () => {
    const { secret } = await createAdmin();
    const { jar } = await signedIn(secret);
    await invite(jar, "sara@hagz.app");
    await invite(jar, "ali@hagz.app");
    await accept(tokenFrom("ali@hagz.app"));

    const open = await request("GET", "/admin/invitations", { jar });
    const { data } = (await open.json()) as {
      data: { id: string; email: string; invitedBy: string }[];
    };
    expect(data.map((i) => [i.email, i.invitedBy])).toEqual([["sara@hagz.app", "Omar"]]);
    const [sara] = data;

    const revoked = await request("DELETE", `/admin/invitations/${sara?.id ?? ""}`, { jar });
    expect(revoked.status).toBe(204);
    expect((await request("DELETE", `/admin/invitations/${sara?.id ?? ""}`, { jar })).status).toBe(
      204,
    );
    expect((await json(await accept(tokenFrom("sara@hagz.app")))).code).toBe("INVITATION_INVALID");

    const used = await prisma.adminInvitation.findFirstOrThrow({
      where: { email: "ali@hagz.app" },
    });
    expect((await request("DELETE", `/admin/invitations/${used.id}`, { jar })).status).toBe(409);
    expect((await request("DELETE", `/admin/invitations/${randomUUID()}`, { jar })).status).toBe(
      404,
    );
    expect((await request("GET", "/admin/invitations", { jar, header: false })).status).toBe(403);
  });
});

describe("admin details", () => {
  const invite = (jar: Jar, email: string) =>
    request("POST", "/admin/invitations", { body: { email }, jar });
  const tokenFrom = (email: string) =>
    new URL(mailbox.lastInvitationTo(email)?.acceptUrl ?? "http://x").hash.replace("#token=", "");

  it("shows who invited an admin, their invites and the browsers they're signed in on", async () => {
    const omar = await createAdmin();
    const { jar } = await signedIn(omar.secret);
    await signedIn(omar.secret, 1);
    await invite(jar, "sara@hagz.app");
    await request("POST", "/auth/admin/invitations/accept", {
      body: { token: tokenFrom("sara@hagz.app"), name: "Sara", password: PASSWORD },
    });
    const sara = await prisma.admin.findUniqueOrThrow({ where: { email: "sara@hagz.app" } });

    const own = await request("GET", `/admin/list/${omar.id}`, { jar });
    expect(own.status).toBe(200);
    const details = AdminDetails.parse(await own.json());
    expect(details).toMatchObject({
      email: EMAIL,
      invitedBy: null,
      invitesSent: 1,
      authenticatorSetUp: true,
    });
    expect(details.authenticatorSetUpAt).toEqual(expect.any(String));
    // Both sign-ins, with this request's session marked.
    expect(details.devices).toHaveLength(2);
    expect(details.devices.filter((device) => device.current)).toHaveLength(1);

    const invited = AdminDetails.parse(
      await (await request("GET", `/admin/list/${sara.id}`, { jar })).json(),
    );
    expect(invited).toMatchObject({
      invitedBy: "Omar",
      invitesSent: 0,
      authenticatorSetUp: false,
      authenticatorSetUpAt: null,
      devices: [],
    });

    expect((await json(await request("GET", `/admin/list/${randomUUID()}`, { jar }))).code).toBe(
      "ADMIN_NOT_FOUND",
    );
    expect((await request("GET", `/admin/list/${sara.id}`, { jar: {} })).status).toBe(401);
  });
});

describe("admin resets", () => {
  it("reset another admin's authenticator: signed out, and set up again on the next sign-in", async () => {
    const omar = await createAdmin();
    const sara = await createAdmin({ email: "sara@hagz.app" });
    const { jar } = await signedIn(omar.secret);
    const { challengeToken } = await signIn("sara@hagz.app");
    const saraSignedIn = jarFrom(await complete(challengeToken, currentCode(sara.secret)));

    const res = await request("DELETE", `/admin/list/${sara.id}/authenticator`, { jar });
    expect(res.status).toBe(204);
    expect(
      await prisma.admin.findUniqueOrThrow({
        where: { id: sara.id },
        select: { totpSecret: true, totpConfirmedAt: true },
      }),
    ).toEqual({ totpSecret: null, totpConfirmedAt: null });
    // Her session can't be refreshed any more.
    const refresh = await request("POST", "/auth/admin/sessions/refresh", { jar: saraSignedIn });
    expect((await json(refresh)).code).toBe("SESSION_ENDED");
    expect((await signIn("sara@hagz.app")).next).toBe("TOTP_SETUP");
  });

  it("refuse to reset your own authenticator, or an admin that doesn't exist", async () => {
    const omar = await createAdmin();
    const { jar } = await signedIn(omar.secret);
    const own = await request("DELETE", `/admin/list/${omar.id}/authenticator`, { jar });
    expect((await json(own)).code).toBe("OWN_ADMIN_ACCOUNT");
    const missing = await request("DELETE", `/admin/list/${randomUUID()}/authenticator`, { jar });
    expect((await json(missing)).code).toBe("ADMIN_NOT_FOUND");
    expect((await signIn()).next).toBe("TOTP");
  });
});

describe("admin password resets", () => {
  const NEW_PASSWORD = "a brand new password";
  const requestReset = (jar: Jar, id: string) =>
    request("POST", `/admin/list/${id}/password-reset`, { jar });
  const tokenFor = (email: string) =>
    new URL(mailbox.lastResetTo(email)?.resetUrl ?? "http://x").hash.replace("#token=", "");
  const reset = (token: string, password = NEW_PASSWORD) =>
    request("POST", "/auth/admin/password-reset", { body: { token, password } });

  it("email a link that sets a new password once and signs the admin out", async () => {
    const omar = await createAdmin();
    const sara = await createAdmin({ email: "sara@hagz.app" });
    const { jar } = await signedIn(omar.secret);
    const { challengeToken } = await signIn("sara@hagz.app");
    const saraJar = jarFrom(await complete(challengeToken, currentCode(sara.secret)));

    expect((await requestReset(jar, sara.id)).status).toBe(204);
    const sent = mailbox.lastResetTo("sara@hagz.app");
    expect(sent?.requestedBy).toBe("Omar");
    // Like invitations, the token is in the fragment, which never reaches a server.
    expect(sent?.resetUrl).toMatch(/^http:\/\/localhost:3001\/admin\/password\/reset#token=/);
    // Asking changes nothing: the old password still works and she's still signed in.
    expect((await signIn("sara@hagz.app")).next).toBe("TOTP");

    const token = tokenFor("sara@hagz.app");
    expect((await reset(token)).status).toBe(204);
    expect((await json(await reset(token))).code).toBe("PASSWORD_RESET_INVALID");
    const refresh = await request("POST", "/auth/admin/sessions/refresh", { jar: saraJar });
    expect((await json(refresh)).code).toBe("SESSION_ENDED");
    const old = await request("POST", "/auth/admin/sessions", {
      body: { email: "sara@hagz.app", password: PASSWORD },
    });
    expect(old.status).toBe(401);
    expect((await signIn("sara@hagz.app", NEW_PASSWORD)).next).toBe("TOTP");
  });

  it("only honour the newest link, and not for a suspended admin", async () => {
    const omar = await createAdmin();
    const sara = await createAdmin({ email: "sara@hagz.app" });
    const { jar } = await signedIn(omar.secret);
    await requestReset(jar, sara.id);
    const first = tokenFor("sara@hagz.app");
    await requestReset(jar, sara.id);
    const second = tokenFor("sara@hagz.app");
    expect((await json(await reset(first))).code).toBe("PASSWORD_RESET_INVALID");

    await prisma.admin.update({ where: { id: sara.id }, data: { status: "SUSPENDED" } });
    expect((await json(await reset(second))).code).toBe("PASSWORD_RESET_INVALID");
  });

  it("refuse your own account and unknown admins, and need a session to ask", async () => {
    const omar = await createAdmin();
    const { jar } = await signedIn(omar.secret);
    expect((await json(await requestReset(jar, omar.id))).code).toBe("OWN_ADMIN_ACCOUNT");
    expect((await json(await requestReset(jar, randomUUID()))).code).toBe("ADMIN_NOT_FOUND");
    expect((await requestReset({}, omar.id)).status).toBe(401);
    expect(mailbox.resets).toHaveLength(0);
    expect((await json(await reset("not-a-token"))).code).toBe("PASSWORD_RESET_INVALID");
  });
});

describe("admin's own account", () => {
  const NEW_PASSWORD = "a brand new password";
  const change = (jar: Jar, currentPassword: string, newPassword = NEW_PASSWORD) =>
    request("POST", "/auth/admin/me/password", { jar, body: { currentPassword, newPassword } });

  it("renames the signed-in admin, and refuses an empty name", async () => {
    const { secret } = await createAdmin();
    const { jar } = await signedIn(secret);

    const renamed = await request("PATCH", "/auth/admin/me", { jar, body: { name: "  Omar S  " } });
    expect(renamed.status).toBe(200);
    expect(await json(renamed)).toMatchObject({ name: "Omar S", email: EMAIL });
    expect(await json(await request("GET", "/auth/admin/me", { jar }))).toMatchObject({
      name: "Omar S",
    });
    const empty = await request("PATCH", "/auth/admin/me", { jar, body: { name: "  " } });
    expect(empty.status).toBe(400);
  });

  it("changes the password after the current one, keeping this browser and signing out others", async () => {
    const { id, secret } = await createAdmin();
    const { jar } = await signedIn(secret);
    const other = await signedIn(secret, 1);

    const wrong = await change(jar, "not my password");
    expect(wrong.status).toBe(400);
    expect((await json(wrong)).code).toBe("WRONG_PASSWORD");

    expect((await change(jar, PASSWORD)).status).toBe(204);
    expect((await request("POST", "/auth/admin/sessions/refresh", { jar })).status).toBe(204);
    const elsewhere = await request("POST", "/auth/admin/sessions/refresh", { jar: other.jar });
    expect((await json(elsewhere)).code).toBe("SESSION_ENDED");
    expect(await prisma.adminSession.count({ where: { adminId: id, revokedAt: null } })).toBe(1);

    const old = await request("POST", "/auth/admin/sessions", {
      body: { email: EMAIL, password: PASSWORD },
    });
    expect(old.status).toBe(401);
    expect((await signIn(EMAIL, NEW_PASSWORD)).next).toBe("TOTP");
  });

  it("stops a reset link another admin sent", async () => {
    const omar = await createAdmin();
    const sara = await createAdmin({ email: "sara@hagz.app" });
    const { jar } = await signedIn(omar.secret);
    expect((await request("POST", `/admin/list/${sara.id}/password-reset`, { jar })).status).toBe(
      204,
    );
    const token = new URL(
      mailbox.lastResetTo("sara@hagz.app")?.resetUrl ?? "http://x",
    ).hash.replace("#token=", "");

    const { challengeToken } = await signIn("sara@hagz.app");
    const saraJar = jarFrom(await complete(challengeToken, currentCode(sara.secret)));
    expect((await change(saraJar, PASSWORD)).status).toBe(204);

    const late = await request("POST", "/auth/admin/password-reset", {
      body: { token, password: "yet another password" },
    });
    expect((await json(late)).code).toBe("PASSWORD_RESET_INVALID");
  });

  it("limits guesses at the current password", async () => {
    const { secret } = await createAdmin();
    const { jar } = await signedIn(secret);
    for (let i = 0; i < 5; i++) expect((await change(jar, `guess ${i}`)).status).toBe(400);
    expect((await change(jar, PASSWORD)).status).toBe(429);
  });
});
