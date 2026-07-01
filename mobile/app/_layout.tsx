import { Stack, SplashScreen } from 'expo-router';
import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import '@/i18next/i18next';

import '../global.css';

SplashScreen.preventAutoHideAsync();

function SplashScreenController() {
  const { isLoading } = useAuth();
  
  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  return null;
}

function RootNavigator() {
  const { user, isLoading } = useAuth();
  const role = user?.preferences.role;
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    if (!isLoading) {
      const id = requestAnimationFrame(() => setIsMounted(true));
      return () => cancelAnimationFrame(id);
    }
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false, animation: isMounted ? "default" : "none" }}>
      <Stack.Protected guard={!user || role === 'USER'}>
        <Stack.Screen name="user" />
      </Stack.Protected>
      <Stack.Protected guard={!!user && role !== 'USER'}>
        <Stack.Screen name="dashboard" />
      </Stack.Protected>
      <Stack.Screen name="auth"/>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <AuthProvider>
        <SplashScreenController />
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}