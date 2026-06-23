import { Stack } from 'expo-router';
import '../global.css';
import AuthModal from '@/components/general/AuthModal';

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <AuthModal />
    </>
  );
}
