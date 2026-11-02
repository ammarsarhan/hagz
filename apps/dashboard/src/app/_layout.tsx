import "../global.css";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { FONTS } from "@/lib/fonts";

export default function RootLayout() {
  // Nothing renders until the fonts are in, so no screen flashes in the system font. A font that
  // fails to load falls back to the system font rather than blocking the app, so say so in dev.
  const [loaded, error] = useFonts(FONTS);
  if (error && __DEV__) console.warn("Fonts failed to load; using the system font.", error);
  if (!loaded && !error) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}
