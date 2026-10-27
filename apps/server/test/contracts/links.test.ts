import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { APPS, links, ROUTES, type AppName } from "@hagz/contracts";
import { describe, expect, it } from "vitest";

// The route table in @hagz/contracts must match the apps: a link Hagz sends has to land somewhere.
const APPS_DIR = fileURLToPath(new URL("../../../", import.meta.url));
const appNames = Object.keys(APPS) as AppName[];

describe("links", () => {
  it("gives every app a path prefix that doesn't overlap another's", () => {
    for (const a of appNames) {
      for (const b of appNames) {
        if (a !== b) expect(APPS[a].pathPrefix.startsWith(APPS[b].pathPrefix)).toBe(false);
      }
    }
  });

  it("builds app links under their app's prefix, on the web app's origin", () => {
    const built = links("https://staging.hagz.app/");
    for (const [name, route] of Object.entries(ROUTES)) {
      const url = new URL(built[name as keyof typeof built]("K7M2QX"));
      expect(url.origin, name).toBe("https://staging.hagz.app");
      if (route.app !== "web") {
        expect(url.pathname.startsWith(`${APPS[route.app].pathPrefix}/`), name).toBe(true);
      }
    }
  });

  it("has a screen in the app, or a page in the web app, for every route", () => {
    for (const [name, route] of Object.entries(ROUTES)) {
      const file =
        route.app === "web"
          ? `${APPS_DIR}web/src/app${route.path}/page.tsx`
          : `${APPS_DIR}${route.app}/src/app${route.path}.tsx`;
      expect(existsSync(file), `${name} -> ${file}`).toBe(true);
    }
  });

  it("keeps admin invitation tokens out of the URL that reaches servers", () => {
    const url = new URL(links("https://hagz.app").adminInvitation("secret-token"));
    expect(url.pathname + url.search).not.toContain("secret-token");
    expect(url.hash).toBe("#token=secret-token");
  });
});
