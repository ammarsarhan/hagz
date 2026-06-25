import { useEffect, ReactNode } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import * as SplashScreen from 'expo-splash-screen';

import '../global.css';
import AuthModal from '@/components/AuthModal';

// Keep the splash screen up until auth state is resolved.
SplashScreen.preventAutoHideAsync();

// Hides the splash screen once auth has finished loading.
function AppLayout({ children }: { children: ReactNode }) {
  const { isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <AuthProvider>
        <AppLayout>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack>
          <AuthModal />
        </AppLayout>
      </AuthProvider>
    </QueryClientProvider>
  );
}
