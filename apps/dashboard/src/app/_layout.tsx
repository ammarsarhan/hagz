import "../global.css";
import "@/i18next/i18next";
import { Stack } from "expo-router";
import { HudProvider } from "@/components/hud";

export default function RootLayout() {
  return (
    <HudProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </HudProvider>
  );
}
