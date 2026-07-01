import { Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function OnboardingLayout() {
  const { user } = useAuth();
  const role = !!user && user.preferences.role;

  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Protected guard={role === 'OWNER'}>
        <Stack.Screen name="owner" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'MANAGER'}>
        <Stack.Screen name="manager" />
      </Stack.Protected>
    </Stack>
  );
}