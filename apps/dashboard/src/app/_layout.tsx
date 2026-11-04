import "../global.css";
import "@/i18next/i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { HudProvider } from "@/components/hud";
import { queryClient } from "@/lib/query";

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <HudProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </HudProvider>
    </QueryClientProvider>
  );
}
