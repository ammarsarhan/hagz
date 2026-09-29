import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Hagz Dashboard",
  slug: "hagz-dashboard",
  version: "0.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  plugins: ["expo-router"],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
