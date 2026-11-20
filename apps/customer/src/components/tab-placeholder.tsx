import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { Text } from "./text";

// A tab that isn't built yet: its title and a line saying what will be there. SafeAreaView is
// native and className doesn't reach it, so its white is a style and the gutters sit inside.
export function TabPlaceholder({ title, line }: { title: string; line: string }) {
  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.white, direction: isRTL ? "rtl" : "ltr" }}
    >
      <View className="mt-6 gap-2 px-6">
        <Text accessibilityRole="header" className="text-title font-semibold tracking-[-0.4px]">
          {title}
        </Text>
        <Text className="text-subtitle text-ink-2">{line}</Text>
      </View>
    </SafeAreaView>
  );
}
