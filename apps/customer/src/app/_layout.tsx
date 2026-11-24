import "../global.css";
import "@/i18next/i18next";
import { Stack } from "expo-router";
import { HudProvider } from "@/components/hud";

// Your code for the desk rises from the bottom, a modal over the booking or game, and closes with
// its ×, rather than sliding in as the next page (user, 2026-11-23).
const MODAL = { presentation: "fullScreenModal", animation: "slide_from_bottom" } as const;

export default function RootLayout() {
  return (
    <HudProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="bookings/[id]/check-in" options={MODAL} />
        <Stack.Screen name="game/[id]/check-in" options={MODAL} />
      </Stack>
    </HudProvider>
  );
}
