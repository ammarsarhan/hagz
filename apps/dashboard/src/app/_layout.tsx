import "../global.css";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { VariableContextProvider } from "nativewind";
import { FONT_FAMILIES, FONTS } from "@/lib/fonts";

export default function RootLayout() {
  // Nothing renders until the fonts are in, so no screen flashes in the system font. A font that
  // fails to load falls back to the system font rather than blocking the app.
  const [loaded, error] = useFonts(FONTS);
  if (!loaded && !error) return null;

  return (
    // English until the app has its language setting; FONT_FAMILIES.ar swaps in Noto Sans Arabic.
    <VariableContextProvider value={FONT_FAMILIES.en}>
      <Stack screenOptions={{ headerShown: false }} />
    </VariableContextProvider>
  );
}
