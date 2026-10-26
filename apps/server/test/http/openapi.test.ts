import { describe, expect, it } from "vitest";
import { router } from "@/http/router";

describe("OpenAPI document", () => {
  // The committed openapi.json is the contract the apps build against. Any change to it shows up in
  // the pull request diff; regenerate with `pnpm test -u` once the change is intended.
  it("matches the committed contract", async () => {
    const res = await router.request("/v1/openapi.json");
    expect(res.status).toBe(200);

    await expect(`${JSON.stringify(await res.json(), null, 2)}\n`).toMatchFileSnapshot(
      "../../openapi.json",
    );
  });
});
