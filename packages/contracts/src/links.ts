// Every link Hagz sends or opens, in one route table, so the server, the web app and the Expo apps
// agree on paths. Links are https URLs on the web app's domain: when the app is installed the OS
// opens it there (universal links / app links); otherwise the web app serves a fallback page.

export const ENVIRONMENTS = ["development", "staging", "production"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

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

// `path` doubles as the Expo Router file inside that app ("web" routes are pages of the web app).
export const ROUTES = {
  staffInvitation: { app: "dashboard", path: "/manage/invite/[code]" },
  adminInvitation: { app: "web", path: "/admin/invitations/accept" },
} as const satisfies Record<string, { app: AppName | "web"; path: string }>;

export type RouteName = keyof typeof ROUTES;

// Non-production builds get their own ids and schemes, so they install next to the production app.
export const bundleIdFor = (app: AppName, env: Environment) =>
  env === "production" ? APPS[app].bundleId : `${APPS[app].bundleId}.${env}`;

export const schemeFor = (app: AppName, env: Environment) =>
  env === "production" ? APPS[app].scheme : `${APPS[app].scheme}-${env}`;

export const appNameFor = (app: AppName, env: Environment) =>
  env === "production" ? APPS[app].name : `${APPS[app].name} (${env})`;

const fill = (path: string, value: string) => path.replace(/\[[^\]]+\]/, encodeURIComponent(value));

// The only way anything should build a link. `webUrl` is the web app's origin in that environment.
export const links = (webUrl: string) => {
  const base = webUrl.replace(/\/+$/, "");
  return {
    staffInvitation: (code: string) => base + fill(ROUTES.staffInvitation.path, code),
    // The token goes in the fragment, which browsers never send to a server: it stays out of access
    // logs and Referer headers. The page reads it with JavaScript.
    adminInvitation: (token: string) =>
      `${base}${ROUTES.adminInvitation.path}#token=${encodeURIComponent(token)}`,
  } satisfies Record<RouteName, (value: string) => string>;
};
