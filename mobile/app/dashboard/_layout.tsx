import { Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function DashboardLayout() {
  const { user } = useAuth();
  const hasPitches = !!user && user.pitches.length >= 1;

  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Protected guard={!hasPitches}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={hasPitches}>
        <Stack.Screen name="main" />
      </Stack.Protected>
    </Stack>
  );
}