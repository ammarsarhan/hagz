import { afterEach, expect, it, vi } from "vitest";
import { router } from "@/http/router";
import { logger } from "@/platform/logger/logger";

// The access log names the route that answered, not the last one whose pattern fits the path:
// /v1/venues/spread also fits /v1/venues/{slug}.

afterEach(() => {
  vi.restoreAllMocks();
});

it("logs each request under the route that handled it", async () => {
  const routes: string[] = [];
  vi.spyOn(logger, "info").mockImplementation(((line: { route?: string }) => {
    if (line.route) routes.push(line.route);
  }) as never);
  await router.request("/v1/venues/spread?marketplace=EG&q=x");
  await router.request("/v1/venues/coverage?marketplace=EG");
  await router.request("/v1/venues/some-slug");
  expect(routes).toEqual(["/v1/venues/spread", "/v1/venues/coverage", "/v1/venues/:slug"]);
});
