import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { Pressable, Text } from 'react-native';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function Profile() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/sign-in');
  };

  const { i18n } = useTranslation();

  return (
    <SafeAreaView className="flex-1">
      {
        user ?
        <>
          <Pressable onPress={handleSignOut}>
            <Text>Sign out</Text>
          </Pressable>
          <Text>{i18n.language}</Text>
        </> :
        <Pressable onPress={() => router.replace('/sign-in')}>
          <Text>Sign in</Text>
        </Pressable>
      }
    </SafeAreaView>
  );
}
