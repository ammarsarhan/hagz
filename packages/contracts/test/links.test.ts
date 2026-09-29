import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { APPS, ENVIRONMENTS, links, ROUTES, type AppName } from "../src";

const APPS_DIR = fileURLToPath(new URL("../../../apps/", import.meta.url));
const appNames = Object.keys(APPS) as AppName[];

describe("deep links", () => {
  it("gives every app a path prefix that doesn't overlap another app's", () => {
    for (const a of appNames) {
      for (const b of appNames) {
        if (a === b) continue;
        expect(APPS[a].pathPrefix.startsWith(APPS[b].pathPrefix), `${a} overlaps ${b}`).toBe(false);
      }
    }
  });

  it("builds every link under the prefix of the app it belongs to", () => {
    for (const env of ENVIRONMENTS) {
      const built = links(env);
      for (const [name, route] of Object.entries(ROUTES)) {
        const url = new URL(built[name as keyof typeof built]("x"));
        expect(url.pathname.startsWith(`${APPS[route.app].pathPrefix}/`), name).toBe(true);
      }
    }
  });

  it("has a matching Expo Router screen for every route", () => {
    for (const [name, route] of Object.entries(ROUTES)) {
      const file = `${APPS_DIR}${route.app}/src/app${route.path}.tsx`;
      expect(existsSync(file), `${name} -> ${file}`).toBe(true);
    }
  });
});
