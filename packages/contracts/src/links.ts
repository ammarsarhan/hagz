export const ENVIRONMENTS = ["development", "staging", "production"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const parseEnvironment = (value: string | undefined): Environment => {
  const env = value ?? "development";
  if (!(ENVIRONMENTS as readonly string[]).includes(env)) {
    throw new Error(`Invalid APP_ENV "${env}". Expected one of: ${ENVIRONMENTS.join(", ")}`);
  }
  return env as Environment;
};

// Placeholder domains until the real one is decided.
const DOMAINS: Record<Environment, string> = {
  development: "dev.hagz.app",
  staging: "staging.hagz.app",
  production: "hagz.app",
};

export const APPS = {
  customer: {
    name: "Hagz",
    bundleId: "app.hagz.customer",
    scheme: "hagz",
    pathPrefix: "/booking",
  },
  dashboard: {
    name: "Hagz Dashboard",
    bundleId: "app.hagz.dashboard",
    scheme: "hagz-dashboard",
    pathPrefix: "/manage",
  },
} as const;

export type AppName = keyof typeof APPS;

// Every deep-linkable route. `path` doubles as the Expo Router file path inside that app.
export const ROUTES = {
  sharedBooking: { app: "customer", path: "/booking/[token]" },
  manageBooking: { app: "dashboard", path: "/manage/bookings/[id]" },
  staffInvite: { app: "dashboard", path: "/manage/invite/[code]" },
} as const satisfies Record<string, { app: AppName; path: string }>;

export type RouteName = keyof typeof ROUTES;

// Non-production builds get their own IDs so they can be installed next to the production app.
export const bundleIdFor = (app: AppName, env: Environment) =>
  env === "production" ? APPS[app].bundleId : `${APPS[app].bundleId}.${env}`;

export const schemeFor = (app: AppName, env: Environment) =>
  env === "production" ? APPS[app].scheme : `${APPS[app].scheme}-${env}`;

export const appNameFor = (app: AppName, env: Environment) =>
  env === "production" ? APPS[app].name : `${APPS[app].name} (${env})`;

export const domainFor = (env: Environment) => DOMAINS[env];

const fill = (path: string, value: string) => path.replace(/\[[^\]]+\]/, encodeURIComponent(value));

// The only way anything in the codebase should build a link.
export const links = (env: Environment) => {
  const base = `https://${DOMAINS[env]}`;
  return {
    sharedBooking: (token: string) => base + fill(ROUTES.sharedBooking.path, token),
    manageBooking: (id: string) => base + fill(ROUTES.manageBooking.path, id),
    staffInvite: (code: string) => base + fill(ROUTES.staffInvite.path, code),
  } satisfies Record<RouteName, (value: string) => string>;
};
