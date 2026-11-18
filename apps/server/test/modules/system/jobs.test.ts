import { JobsStatus } from "@hagz/contracts";
import { Worker } from "bullmq";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { generationQueue } from "@/modules/venues/application/slot-generation";
import { totpCode, totpStep } from "@/platform/crypto/totp";
import { queueConnection } from "@/platform/redis/connections";
import { resetDatabase } from "../../support/database";
import { createAdmin } from "../../support/factories";
import { resetRedis } from "../../support/redis";

// The admin Home's Jobs card (PR 2.6): the queues, the nightly runs, failed jobs and Retry.

const request = (path: string, cookie: string, method = "GET") =>
  router.request(`/v1${path}`, {
    method,
    headers: { "content-type": "application/json", "X-Hagz-Admin": "1", Cookie: cookie },
  });

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
  return done.headers
    .getSetCookie()
    .map((cookie) => cookie.split("; ")[0])
    .join("; ");
};

const GROUND = "0190f2a4-0000-7000-8000-000000000001";

// A slot generation run that fails on its only attempt, through a worker that always throws.
const aFailedRun = async () => {
  const worker = new Worker(
    "slot-generation",
    () => Promise.reject(new Error("Postgres went away")),
    { connection: queueConnection },
  );
  try {
    await generationQueue().add("generate", { groundId: GROUND }, { jobId: "generate-test" });
    await expect.poll(() => generationQueue().getFailedCount()).toBe(1);
  } finally {
    await worker.close();
  }
};

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

describe("GET /admin/jobs", () => {
  it("lists every queue, empty, with no nightly run yet", async () => {
    const res = await request("/admin/jobs", await adminCookie());
    expect(res.status).toBe(200);
    const status = JobsStatus.parse(await res.json());
    expect(status.queues.map((queue) => queue.name)).toEqual([
      "slot-generation",
      "slot-maintenance",
      "venue-photo-sweeper",
      "customer-avatar-sweeper",
    ]);
    for (const queue of status.queues) {
      expect(queue).toMatchObject({ waiting: 0, active: 0, failed: 0, oldestWaitingAt: null });
    }
    expect(status.lastRuns).toEqual({ rollForward: null, audit: null, checks: null });
    expect(status.failed).toEqual([]);
  });

  it("counts waiting jobs and says when the oldest was queued", async () => {
    await generationQueue().add("generate", { groundId: GROUND }, { jobId: "generate-a" });
    await generationQueue().add("generate", { groundId: GROUND }, { jobId: "generate-b" });
    const status = JobsStatus.parse(
      await (await request("/admin/jobs", await adminCookie())).json(),
    );
    const generation = status.queues.find((queue) => queue.name === "slot-generation");
    expect(generation).toMatchObject({ waiting: 2 });
    const oldest = await generationQueue().getJob("generate-a");
    expect(generation?.oldestWaitingAt).toBe(new Date(oldest?.timestamp ?? 0).toISOString());
  });

  it("shows a job that failed on its last attempt, with why and for which ground", async () => {
    await aFailedRun();
    const status = JobsStatus.parse(
      await (await request("/admin/jobs", await adminCookie())).json(),
    );
    expect(status.failed).toEqual([
      {
        queue: "slot-generation",
        id: "generate-test",
        name: "generate",
        groundId: GROUND,
        reason: "Postgres went away",
        attempts: 1,
        failedAt: expect.any(String) as string,
      },
    ]);
  });

  it("needs a signed-in admin", async () => {
    const res = await router.request("/v1/admin/jobs", { headers: { "X-Hagz-Admin": "1" } });
    expect(res.status).toBe(401);
  });
});

describe("POST /admin/jobs/{queue}/{jobId}/retry", () => {
  it("queues a failed job again", async () => {
    await aFailedRun();
    const cookie = await adminCookie();
    const res = await request("/admin/jobs/slot-generation/generate-test/retry", cookie, "POST");
    expect(res.status).toBe(204);
    expect(await generationQueue().getFailedCount()).toBe(0);
    expect(await generationQueue().getWaitingCount()).toBe(1);
    // It isn't failed any more.
    const again = await request("/admin/jobs/slot-generation/generate-test/retry", cookie, "POST");
    expect(again.status).toBe(404);
  });

  it("refuses a job that isn't there, or a queue that isn't one", async () => {
    const cookie = await adminCookie();
    const missing = await request("/admin/jobs/slot-generation/nope/retry", cookie, "POST");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: "JOB_NOT_FOUND" });
    expect((await request("/admin/jobs/elsewhere/nope/retry", cookie, "POST")).status).toBe(400);
  });
});
