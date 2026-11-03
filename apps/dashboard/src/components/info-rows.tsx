import { Pressable, View } from "react-native";
import { Text } from "./text";

interface Row {
  title: string;
  body: string;
  // Makes the row a button (first run's "More ways to start"); without it the row only explains.
  onPress?: () => void;
}

// Explanation rows from the Figma screens: a medium heading and a grey line each, between hairlines.
// For explaining consequences calmly, instead of a tinted callout.
export function InfoRows({ rows }: { rows: Row[] }) {
  return (
    <View className="border-t border-border">
      {rows.map((row) => (
        <Pressable
          key={row.title}
          accessibilityRole={row.onPress ? "button" : undefined}
          disabled={!row.onPress}
          onPress={row.onPress}
          className="border-b border-border py-4 active:opacity-60"
        >
          <Text className="mb-[3px] text-subtitle font-medium">{row.title}</Text>
          <Text className="text-body text-ink-2">{row.body}</Text>
        </Pressable>
      ))}
    </View>
  );
}
