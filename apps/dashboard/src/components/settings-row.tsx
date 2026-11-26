import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { GroupHeading } from "./group-heading";
import { Text } from "./text";

// The account screen's rows, as approved in Figma ("D4 · Account, round 2"): a medium 15 title, an
// optional grey 13 line saying what it does, and a trailing switch or icon, over a hairline.
export function SettingsRow({
  title,
  body,
  bodyIcon,
  trailing,
  onPress,
  divider = true,
}: {
  title: string;
  body?: string;
  // A small sign before the grey line (the warning on a setting that's still required).
  bodyIcon?: ReactNode;
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
        <Text className="text-[15px] font-medium leading-[1.33]">{title}</Text>
        {body ? (
          <View className="mt-0.5 flex-row items-center gap-1">
            {bodyIcon}
            <Text className="flex-1 text-caption text-ink-2">{body}</Text>
          </View>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

// The heading over a group of rows (GroupHeading), spaced for the account screen.
export function SettingsHeading({
  children,
  first = false,
  tight = false,
}: {
  children: string;
  first?: boolean;
  // Closer to what's above it: the Venue tab's first heading, under the venue's name.
  tight?: boolean;
}) {
  return (
    <GroupHeading className={`mb-1 ${tight ? "mt-5" : first ? "mt-8" : "mt-7"}`}>
      {children}
    </GroupHeading>
  );
}
