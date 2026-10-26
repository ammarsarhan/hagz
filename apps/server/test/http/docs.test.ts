import { describe, expect, it } from "vitest";
import { router } from "@/http/router";

describe("API docs", () => {
  it("serves a browsable page for the OpenAPI document outside production", async () => {
    const res = await router.request("/v1/docs");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("/v1/openapi.json");
    // Third-party script: a pinned version, never "latest".
    expect(html).toMatch(/@scalar\/api-reference@\d+\.\d+\.\d+\//);
  });
});
