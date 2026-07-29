// USER accounts are created and onboarded entirely through the
// customer app. There's no dashboard-side onboarding step for them,
// so they're always allowed straight into (tabs).

import { useAuth } from "@/context/AuthContext";
import { Stack } from "expo-router";

const tabStates = ["MAINTENANCE", "LIVE"];

export default function RootNavigator() {
  const { user } = useAuth();
  const isOnboarded = !!user && (user.preferences.role === "USER" || user.pitches.some(pitch => tabStates.includes(pitch.status)));

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!user && !isOnboarded}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={isOnboarded}>
        <Stack.Screen name="(dashboard)" />
      </Stack.Protected>
    </Stack>
  );
}
