import { SystemHistory, SystemStatus } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { startWorkerHeartbeat } from "@/modules/system";
import { takeSample } from "@/modules/system/application/history";
import { totpCode, totpStep } from "@/platform/crypto/totp";
import { resetDatabase } from "../../support/database";
import { createAdmin } from "../../support/factories";
import { queueConnection } from "@/platform/redis/connections";
import { resetRedis } from "../../support/redis";

const request = (path: string, cookie?: string, header = true) =>
  router.request(`/v1${path}`, {
    headers: {
      "content-type": "application/json",
      ...(header && { "X-Hagz-Admin": "1" }),
      ...(cookie && { Cookie: cookie }),
    },
  });

// A signed-in admin's cookies, through the real sign-in and authenticator steps.
const adminCookie = async () => {
  const { secret } = await createAdmin();
  const signIn = await router.request("/v1/auth/admin/sessions", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Hagz-Admin": "1" },
    body: JSON.stringify({ email: "omar@hagz.app", password: "correct horse battery" }),
  });
  const { challengeToken } = (await signIn.json()) as { challengeToken: string };
  const done = await router.request("/v1/auth/admin/sessions/totp", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Hagz-Admin": "1" },
    body: JSON.stringify({ challengeToken, code: totpCode(secret, totpStep(new Date())) }),
  });
  expect(done.status).toBe(201);
  return done.headers
    .getSetCookie()
    .map((cookie) => cookie.split("; ")[0])
    .join("; ");
};

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

describe("admin system status", () => {
  it("reports the server, database and both Redis as up, and the worker down without a heartbeat", async () => {
    const res = await request("/admin/status", await adminCookie());
    expect(res.status).toBe(200);
    const status = SystemStatus.parse(await res.json());

    expect(status.server).toMatchObject({ status: "UP", commit: null });
    expect(status.server.startedAt).toEqual(expect.any(String));
    for (const dependency of [status.database, status.queue, status.cache]) {
      expect(dependency.status).toBe("UP");
      expect(dependency.latencyMs).toBeGreaterThanOrEqual(0);
    }
    expect(status.worker).toEqual({
      status: "DOWN",
      commit: null,
      startedAt: null,
      lastSeenAt: null,
    });
  });

  it("shows the worker up while it beats, and down again once it stops", async () => {
    const cookie = await adminCookie();
    const stop = startWorkerHeartbeat();
    // The first beat is written straight away, but asynchronously.
    await expect
      .poll(
        async () =>
          SystemStatus.parse(await (await request("/admin/status", cookie)).json()).worker.status,
      )
      .toBe("UP");
    const { worker } = SystemStatus.parse(await (await request("/admin/status", cookie)).json());
    expect(worker.startedAt).toEqual(expect.any(String));
    expect(worker.lastSeenAt).toEqual(expect.any(String));

    await stop();
    const after = SystemStatus.parse(await (await request("/admin/status", cookie)).json());
    expect(after.worker.status).toBe("DOWN");
  });

  it("keeps the new worker up when the old one shuts down during a deploy", async () => {
    const cookie = await adminCookie();
    // The new worker of a deploy, already beating (another process, so another entry).
    const next = JSON.stringify({
      instance: "next",
      commit: "abc1234",
      startedAt: new Date().toISOString(),
    });
    await queueConnection.zadd("heartbeat:workers", Date.now(), next);

    // This process is the old worker: it beats, then shuts down.
    const stop = startWorkerHeartbeat();
    await expect.poll(async () => queueConnection.zcard("heartbeat:workers")).toBe(2);
    await stop();

    const { worker } = SystemStatus.parse(await (await request("/admin/status", cookie)).json());
    expect(worker).toMatchObject({ status: "UP", commit: "abc1234" });
  });

  it("is only for signed-in admins sending the admin header", async () => {
    expect((await request("/admin/status")).status).toBe(401);
    expect((await request("/admin/status", await adminCookie(), false)).status).toBe(403);
  });
});

describe("admin status history", () => {
  it("keeps one sample a minute, oldest first, with the checks and the worker's state", async () => {
    const cookie = await adminCookie();
    expect(await takeSample(new Date("2026-11-05T10:00:10Z"), { workerGraceMs: 0 })).toBe(true);
    // A second server instance (or a second call) in the same minute skips it.
    expect(await takeSample(new Date("2026-11-05T10:00:50Z"), { workerGraceMs: 0 })).toBe(false);
    const stop = startWorkerHeartbeat();
    await expect
      .poll(async () => {
        const status = await (await request("/admin/status", cookie)).json();
        return SystemStatus.parse(status).worker.status;
      })
      .toBe("UP");
    expect(await takeSample(new Date("2026-11-05T10:01:05Z"), { workerGraceMs: 0 })).toBe(true);
    await stop();

    const res = await request("/admin/status/history", cookie);
    expect(res.status).toBe(200);
    const { samples } = SystemHistory.parse(await res.json());
    expect(samples.map((s) => [s.at, s.worker])).toEqual([
      ["2026-11-05T10:00:00.000Z", "DOWN"],
      ["2026-11-05T10:01:00.000Z", "UP"],
    ]);
    for (const sample of samples) {
      for (const dependency of [sample.database, sample.queue, sample.cache]) {
        expect(dependency.status).toBe("UP");
      }
    }
  });

  it("gives a missing worker one beat before recording it down, so a late first beat counts as up", async () => {
    const cookie = await adminCookie();
    // The server samples before the worker has beaten, as it does right after a restart or a wake.
    let stop: (() => Promise<void>) | undefined;
    const late = setTimeout(() => {
      stop = startWorkerHeartbeat();
    }, 100);
    expect(await takeSample(new Date("2026-11-05T10:00:00Z"), { workerGraceMs: 1_000 })).toBe(true);
    clearTimeout(late);
    await stop?.();

    // A worker that really is down is still recorded as down once the grace is over.
    expect(await takeSample(new Date("2026-11-05T10:01:00Z"), { workerGraceMs: 100 })).toBe(true);

    const { samples } = SystemHistory.parse(
      await (await request("/admin/status/history", cookie)).json(),
    );
    expect(samples.map((s) => s.worker)).toEqual(["UP", "DOWN"]);
  });

  it("is only for signed-in admins", async () => {
    expect((await request("/admin/status/history")).status).toBe(401);
  });
});
