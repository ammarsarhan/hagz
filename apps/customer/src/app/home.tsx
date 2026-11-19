import { Text, View } from "react-native";

// Where a guest lands after onboarding. A placeholder until Phase 3's Home: lime and black from the
// customer theme.
export default function Home() {
  return (
    <View className="flex-1 items-center justify-center bg-primary">
      <Text className="text-title font-semibold text-on-primary">Hagz</Text>
    </View>
  );
}
