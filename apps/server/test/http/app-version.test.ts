import { describe, expect, it } from "vitest";
import { router } from "@/http/router";

// The test environment sets MIN_CUSTOMER_APP_VERSION=1.4.0 (test/global-setup.ts). /v1/nope passing
// the gate shows up as a 404.
const call = (headers: Record<string, string>, path = "/v1/nope") =>
  router.request(path, { headers });

describe("app version gate", () => {
  it.each([
    ["1.4.0", 404],
    ["2.0.0", 404],
    ["1.10.0", 404], // numeric, not string, comparison
    ["1.3.9", 426],
    ["0.9.9", 426],
  ])("customer %s gets %i", async (version, status) => {
    const res = await call({ "X-App": "customer", "X-App-Version": version });
    expect(res.status).toBe(status);
  });

  it("tells an outdated app the minimum version", async () => {
    const res = await call({ "X-App": "customer", "X-App-Version": "1.3.9" });
    expect(await res.json()).toMatchObject({
      code: "APP_UPDATE_REQUIRED",
      minimumVersion: "1.4.0",
    });
  });

  it.each([["1.4"], ["v1.4.0"], [""]])("rejects the malformed version %j", async (version) => {
    const res = await call({ "X-App": "customer", "X-App-Version": version });
    expect(res.status).toBe(400);
  });

  it("lets through requests without app headers and apps it doesn't know", async () => {
    expect((await call({})).status).toBe(404);
    expect((await call({ "X-App": "kiosk", "X-App-Version": "0.0.1" })).status).toBe(404);
  });

  it("never gates health checks", async () => {
    const res = await call({ "X-App": "customer", "X-App-Version": "0.0.1" }, "/health/live");
    expect(res.status).toBe(200);
  });
});
