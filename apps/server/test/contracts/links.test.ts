import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { APPS, links, ROUTES, type AppName } from "@hagz/contracts";
import { describe, expect, it } from "vitest";

// The route table in @hagz/contracts must match the apps: a link Hagz sends has to land somewhere.
const APPS_DIR = fileURLToPath(new URL("../../../", import.meta.url));
const appNames = Object.keys(APPS) as AppName[];

// Whether a route's file is under `dir`: a web route is a folder per segment ending in page.tsx, an
// Expo Router one the same with its last segment a .tsx file. Route groups, "(dashboard)", are
// folders that aren't in the URL, so any of them may sit between segments.
const hasRoute = (dir: string, segments: string[], web: boolean): boolean => {
  const [first, ...rest] = segments;
  if (first === undefined) return web && existsSync(join(dir, "page.tsx"));
  if (!web && rest.length === 0 && existsSync(join(dir, `${first}.tsx`))) return true;
  if (existsSync(join(dir, first)) && hasRoute(join(dir, first), rest, web)) return true;
  return readdirSync(dir).some(
    (entry) =>
      /^\(.+\)$/.test(entry) &&
      statSync(join(dir, entry)).isDirectory() &&
      hasRoute(join(dir, entry), segments, web),
  );
};

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
      const root = `${APPS_DIR}${route.app}/src/app`;
      const segments = route.path.split("/").filter(Boolean);
      expect(hasRoute(root, segments, route.app === "web"), `${name} -> ${root}${route.path}`).toBe(
        true,
      );
    }
  });

  it("keeps admin invitation tokens out of the URL that reaches servers", () => {
    const url = new URL(links("https://hagz.app").adminInvitation("secret-token"));
    expect(url.pathname + url.search).not.toContain("secret-token");
    expect(url.hash).toBe("#token=secret-token");
  });
});
