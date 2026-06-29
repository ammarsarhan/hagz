import { useAuth } from '@/context/AuthContext';
import { router, Stack } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return (
    <SafeAreaView className='flex-1 items-center justify-center'>
      <ActivityIndicator size="small" color="black"/>
    </SafeAreaView>
  );
  
  if (!user) router.replace("/sign-in");

  return <Stack screenOptions={{ headerShown: false }} />;
}
