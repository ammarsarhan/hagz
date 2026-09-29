import type { ExpoConfig } from "expo/config";
import { APPS, appNameFor, bundleIdFor, domainFor, parseEnvironment, schemeFor } from "@hagz/contracts";

const APP = "customer";
const env = parseEnvironment(process.env.APP_ENV);
const bundleId = bundleIdFor(APP, env);
const domain = domainFor(env);

const config: ExpoConfig = {
  name: appNameFor(APP, env),
  slug: "hagz-customer",
  scheme: schemeFor(APP, env),
  version: "0.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: bundleId,
    associatedDomains: [`applinks:${domain}`],
  },
  android: {
    package: bundleId,
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: domain, pathPrefix: APPS[APP].pathPrefix }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: ["expo-router"],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appEnv: env,
  },
};

export default config;
