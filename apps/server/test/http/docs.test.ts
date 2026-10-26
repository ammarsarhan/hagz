import { describe, expect, it } from "vitest";
import { router } from "@/http/router";

describe("API docs", () => {
  it("serves a browsable page for the OpenAPI document outside production", async () => {
    const res = await router.request("/v1/docs");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("/v1/openapi.json");
  });
});
