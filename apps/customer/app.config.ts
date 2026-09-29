import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Hagz",
  slug: "hagz-customer",
  version: "0.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  plugins: ["expo-router"],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
