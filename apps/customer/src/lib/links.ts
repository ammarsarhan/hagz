import { links } from "@hagz/contracts";
import Constants from "expo-constants";

// Links the app hands out (sharing a venue), built from the route table in @hagz/contracts on the
// web app's origin: EXPO_PUBLIC_WEB_URL in builds, the machine Metro serves from (port 3001, the
// web app's dev server) in development. Null when a build has none, so the app hides Share rather
// than copy a link that goes nowhere.
const devWebUrl = () => {
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `http://${host}:3001` : undefined;
};

const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? (__DEV__ ? devWebUrl() : undefined);

export const webLinks = webUrl ? links(webUrl) : null;
