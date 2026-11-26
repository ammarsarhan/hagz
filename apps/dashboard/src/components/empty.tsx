import type { ReactNode } from "react";
import { View } from "react-native";
import { Button } from "./button";
import { Text } from "./text";

// A list with nothing in it yet: its scene, a heading and a line on what goes here, centred like
// the Calendar's Quiet day, and the button that adds the first one (left out for someone who can't).
export function Empty({
  art,
  title,
  body,
  action,
}: {
  art: ReactNode;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View className="items-center pt-6">
      {art}
      <Text accessibilityRole="header" className="mt-3 mb-2 text-center text-heading font-semibold">
        {title}
      </Text>
      <Text className="text-center text-body text-ink-2" style={{ maxWidth: "85%" }}>
        {body}
      </Text>
      {action ? (
        <View className="mt-6 self-stretch">
          <Button label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}
