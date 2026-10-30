import { createApiClient } from "@hagz/api";
import { secureSessionStore } from "@hagz/api/secure-store";
import Constants from "expo-constants";

// EXPO_PUBLIC_API_URL in builds. In development, the machine Metro serves from, so simulators,
// emulators and phones on the same network all reach the local API without configuration.
const devApiUrl = () => {
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `http://${host}:3000` : undefined;
};

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? devApiUrl() : undefined);
if (!baseUrl) throw new Error("EXPO_PUBLIC_API_URL is not set.");

export const { api, auth } = createApiClient({
  baseUrl,
  audience: "staff",
  store: secureSessionStore(),
  app: { name: "dashboard", version: Constants.expoConfig?.version ?? "0.0.0" },
});
