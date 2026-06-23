import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native';
import { useAuth } from '@/context/AuthContext';

export default function Profile() {
  const { user } = useAuth();

  return (
    <SafeAreaView className="flex-1">
      {
        user ?
        <Text>User is signed in.</Text> :
        <Text>User is completely signed out!</Text>
      }
    </SafeAreaView>
  );
}
