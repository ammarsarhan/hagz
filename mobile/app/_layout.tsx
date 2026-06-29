import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query';
import { AuthProvider } from '@/context/AuthContext';
import * as SplashScreen from 'expo-splash-screen';
import AppLayout from '@/components/AppLayout';
import AuthModal from '@/components/AuthModal';
import '@/i18next/i18next';

import '../global.css';

// Keep the splash screen up until auth state is resolved.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <AuthProvider>
        <AppLayout>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
          </Stack>
          <AuthModal />
        </AppLayout>
      </AuthProvider>
    </QueryClientProvider>
  );
}
