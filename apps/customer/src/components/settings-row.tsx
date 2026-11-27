import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./text";

// The Account tab's rows, as the staff app draws them (its components/settings-row.tsx): a title
// and a grey line under it, something at the end (a chevron, a switch, the open-outside sign), and a
// hairline below. Without onPress the row isn't a button (a switch row handles its own taps).
export function SettingsRow({
  title,
  body,
  leading,
  trailing,
  onPress,
  divider = true,
}: {
  title: string;
  body?: string;
  // An icon before the title, at the start side (a sheet's choices).
  leading?: ReactNode;
  trailing?: ReactNode;
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
      {leading}
      <View className="flex-1">
        <Text className="text-[15px] leading-[1.33] font-medium">{title}</Text>
        {body ? <Text className="mt-0.5 text-caption text-ink-2">{body}</Text> : null}
      </View>
      {trailing}
    </Pressable>
  );
}

// The heading over a group of rows ("Security", "App"): 18 Semi Bold, the staff app's one size for
// every group heading.
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
      className={`mb-1 text-[18px] leading-[1.33] font-semibold ${first ? "mt-8" : "mt-7"}`}
    >
      {children}
    </Text>
  );
}
