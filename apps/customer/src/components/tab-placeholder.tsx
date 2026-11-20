import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "./text";

// A tab that isn't built yet: its title and a line saying what will be there.
export function TabPlaceholder({ title, line }: { title: string; line: string }) {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white px-6">
      <View className="mt-6 gap-2">
        <Text accessibilityRole="header" className="text-title font-semibold tracking-[-0.4px]">
          {title}
        </Text>
        <Text className="text-subtitle text-ink-2">{line}</Text>
      </View>
    </SafeAreaView>
  );
}
