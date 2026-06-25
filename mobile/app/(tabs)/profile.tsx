import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

export default function Profile() {
  const { user } = useAuth();

  return (
    <SafeAreaView className="flex-1">

    </SafeAreaView>
  );
}
