import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./text";

// A choice in a sheet drawn rather than listed (Figma D9): a small drawing of what it does, its
// name, and a grey line under it. Two side by side (⋯ Move/Swap, + New booking/Hold a time).
export function Tile({
  title,
  body,
  art,
  onPress,
}: {
  title: string;
  body: string;
  art: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${body}`}
      onPress={onPress}
      className="flex-1 rounded-2xl border border-border px-4 pt-5 pb-4 active:opacity-70"
    >
      <View className="items-center">{art}</View>
      <Text className="mt-4 text-subtitle font-semibold">{title}</Text>
      <Text className="mt-0.5 text-caption text-ink-2">{body}</Text>
    </Pressable>
  );
}
