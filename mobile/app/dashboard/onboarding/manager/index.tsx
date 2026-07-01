import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Invitation() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center">
      <Text>
        Index: Invitations status for a manager. Allow them to render the Profile screen to modify
        their account status.
      </Text>
    </SafeAreaView>
  );
}
