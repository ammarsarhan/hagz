import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from "react-native";

export default function Home() {
  return (
      <SafeAreaView className="flex-1 items-center justify-center">
        <Text>Owner dashboard</Text>
      </SafeAreaView>
  );
}
