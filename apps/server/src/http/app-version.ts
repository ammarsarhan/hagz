import { createMiddleware } from "hono/factory";
import { env } from "@/platform/config/env";
import { AppError } from "@/platform/errors/app-error";

// Mobile builds can't be updated from the server, so the API refuses ones too old to talk to it
// (docs/architecture.md, "API conventions"). The Expo apps send X-App and X-App-Version. Requests
// without them (the web app, webhooks, tools) and apps we don't know pass through.
type Version = readonly [number, number, number];

const parse = (text: string): Version | undefined => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
};

const isOlder = (a: Version, b: Version) => (a[0] - b[0] || a[1] - b[1] || a[2] - b[2]) < 0;

const minimum = (text: string) => {
  const version = parse(text);
  // Unreachable: env.ts already validated the format.
  if (!version) throw new Error(`Invalid minimum app version: ${text}`);
  return { text, version };
};

const minimums: Partial<Record<string, { text: string; version: Version }>> = {
  customer: minimum(env.MIN_CUSTOMER_APP_VERSION),
  dashboard: minimum(env.MIN_DASHBOARD_APP_VERSION),
};

export const appVersion = createMiddleware(async (c, next) => {
  const app = c.req.header("X-App");
  const required = app ? minimums[app] : undefined;
  if (!required) return next();

  const version = parse(c.req.header("X-App-Version") ?? "");
  if (!version) {
    throw new AppError({
      code: "BAD_REQUEST",
      status: 400,
      detail: "X-App-Version must be major.minor.patch, e.g. 1.4.0.",
    });
  }
  if (isOlder(version, required.version)) {
    throw new AppError({
      code: "APP_UPDATE_REQUIRED",
      status: 426,
      detail: "This version of the app is no longer supported. Please update it.",
      extensions: { minimumVersion: required.text },
    });
  }
  return next();
});
