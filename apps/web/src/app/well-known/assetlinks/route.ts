import { bundleIdFor, type AppName } from "@hagz/contracts";
import { appEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const fingerprints: Record<AppName, string | undefined> = {
  customer: process.env.ANDROID_SHA256_CUSTOMER,
  dashboard: process.env.ANDROID_SHA256_DASHBOARD,
};

export function GET() {
  return Response.json(
    (Object.keys(fingerprints) as AppName[]).map((app) => ({
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: bundleIdFor(app, appEnv),
        sha256_cert_fingerprints: (fingerprints[app] ?? "").split(",").filter(Boolean),
      },
    })),
  );
}
