import "../global.css";
import "@/i18next/i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { HudProvider } from "@/components/hud";
import { boot, hideSplash } from "@/lib/boot";
import { queryClient } from "@/lib/query";

export default function RootLayout() {
  // Nothing is drawn until the app knows where it opens (lib/boot.ts); the splash covers it.
  const [ready, setReady] = useState(false);
  // The first screen is placed, not pushed: onboarding's redirect to the venue or first run happens
  // under the splash, and shouldn't still be sliding in when it lifts.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    void boot().finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready) hideSplash(() => setSettled(true));
  }, [ready]);
  if (!ready) return null;

  return (
    // Gestures (dragging photos into order) need the root view around everything.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <HudProvider>
          <Stack screenOptions={{ headerShown: false, animation: settled ? "default" : "none" }}>
            {/* The map comes up over the flow rather than sliding in from the side: it's a place
              to do one thing (put the pin down) and leave, and closing it lands back on the name. */}
            <Stack.Screen
              name="create-venue/place"
              options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
            />
            {/* Moving the pin later is the same map, so it comes up the same way. */}
            <Stack.Screen
              name="setup/[venueId]/location"
              options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
            />
          </Stack>
        </HudProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
