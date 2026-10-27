import { APPS, bundleIdFor, type AppName } from "@hagz/contracts";
import { appEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

// iOS fetches this to let the apps open links under their path prefixes (universal links).
export function GET() {
  const teamId = process.env.APPLE_TEAM_ID ?? "";
  const apps = Object.keys(APPS) as AppName[];

  return Response.json({
    applinks: {
      details: apps.map((app) => ({
        appIDs: [`${teamId}.${bundleIdFor(app, appEnv)}`],
        components: [{ "/": `${APPS[app].pathPrefix}/*` }],
      })),
    },
  });
}
