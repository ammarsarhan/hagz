import { describe, expect, it } from "vitest";
import { router } from "@/http/router";

describe("API docs", () => {
  it("serves a browsable page for the OpenAPI document outside production", async () => {
    const res = await router.request("/v1/docs");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("/v1/openapi.json");
    // Third-party script: a pinned version, never "latest", and the classic build that a plain
    // <script src> can run (an ES module there leaves the page blank).
    expect(html).toMatch(
      /<script src="[^"]*@scalar\/api-reference@\d+\.\d+\.\d+\/dist\/browser\/standalone\.js"><\/script>/,
    );
  });
});
