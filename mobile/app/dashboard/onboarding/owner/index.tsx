import { useAuth } from '@/context/AuthContext';
import { View, Text, Pressable } from 'react-native';

export default function Index() {
  const { signOut } = useAuth();

  return (
    <View className="flex-1 items-center justify-center">
      <Pressable onPress={signOut}>
        <Text>Sign out</Text>
      </Pressable>
    </View>
  );
}
