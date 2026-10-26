import { describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { markShuttingDown } from "@/platform/lifecycle/state";
import { queueConnection } from "@/platform/redis/connections";

describe("health", () => {
  it("is live", async () => {
    const res = await router.request("/health/live");
    expect(res.status).toBe(200);
  });

  it("is ready when Postgres and Redis are reachable", async () => {
    await queueConnection.ping();

    const res = await router.request("/health/ready");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", checks: { database: "ok", queue: "ok" } });
  });

  // Last: shutdown can't be undone in this file's module instance.
  it("stops being ready once shutdown starts", async () => {
    markShuttingDown();

    const res = await router.request("/health/ready");

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "shutting_down" });
  });
});
