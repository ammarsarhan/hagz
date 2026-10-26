import { describe, expect, it } from "vitest";

// Its own file: env is read once, at import, so production must be set first. Every test file runs
// in a fresh process, so this doesn't leak into others.
process.env.APP_ENV = "production";
const { router } = await import("@/http/router");

describe("API docs in production", () => {
  it.each(["/v1/docs", "/v1/openapi.json"])("hides %s", async (path) => {
    const res = await router.request(path);
    expect(res.status).toBe(404);
  });
});
