import { View } from "react-native";
import { Text } from "./text";

// Explanation rows from the Figma screens: a medium heading and a grey line each, between hairlines.
// For explaining consequences calmly, instead of a tinted callout.
export function InfoRows({ rows }: { rows: { title: string; body: string }[] }) {
  return (
    <View className="border-t border-border">
      {rows.map((row) => (
        <View key={row.title} className="border-b border-border py-4">
          <Text className="mb-[3px] text-subtitle font-medium">{row.title}</Text>
          <Text className="text-body text-ink-2">{row.body}</Text>
        </View>
      ))}
    </View>
  );
}
