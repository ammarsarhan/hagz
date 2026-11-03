import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./text";

// The account screen's rows, as approved in Figma ("D4 · Account, round 2"): a medium title, an
// optional grey line saying what it does, and a trailing switch or icon, over a hairline.
export function SettingsRow({
  title,
  body,
  trailing,
  onPress,
  divider = true,
}: {
  title: string;
  body?: string;
  trailing?: ReactNode;
  // Without it the row isn't a button (a switch row handles its own taps).
  onPress?: () => void;
  divider?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      className={`flex-row items-center gap-4 py-3.5 active:opacity-60 ${divider ? "border-b border-border" : ""}`}
    >
      <View className="flex-1">
        <Text className="text-subtitle font-medium">{title}</Text>
        {body ? <Text className="mt-0.5 text-label text-ink-2">{body}</Text> : null}
      </View>
      {trailing}
    </Pressable>
  );
}

// The big heading over a group of rows.
export function SettingsHeading({
  children,
  first = false,
}: {
  children: string;
  first?: boolean;
}) {
  return (
    <Text
      accessibilityRole="header"
      className={`mb-1 text-[22px] font-semibold leading-[1.27] ${first ? "mt-8" : "mt-[30px]"}`}
    >
      {children}
    </Text>
  );
}
