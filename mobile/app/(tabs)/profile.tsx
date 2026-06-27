import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';

export default function Profile() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/sign-in');
  }

  return (
    <SafeAreaView className="flex-1">
      {
        user ?
        <Pressable onPress={handleSignOut}>
          <Text>Sign out</Text>
        </Pressable> :
        <Pressable onPress={() => router.replace('/sign-in')}>
          <Text>Sign in</Text>
        </Pressable>
      }
    </SafeAreaView>
  );
}
