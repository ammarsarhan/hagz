import type { ReactNode } from "react";
import { Keyboard, Pressable, View, type LayoutChangeEvent } from "react-native";
import { Text } from "./text";

// The big start-aligned title (28/34, 600) and its grey subtitle, which can hold inline links. An
// `action` (such as "Change" under the number a code went to) gets its own line under the subtitle,
// so it never wraps onto the end of the sentence. `onTitleLayout` says where the title itself sits,
// for a screen that shows it again in the nav bar once it's scrolled away. `small`: the day-picking
// screens (Move, Swap, Hold a time), where the week strip under it should come up sooner: 24/30
// over a 15 subtitle, closer together (user, 2026-11-26).
export function Title({
  children,
  subtitle,
  action,
  onTitleLayout,
  small = false,
}: {
  small?: boolean;
  children: string;
  subtitle?: ReactNode;
  action?: { label: string; onPress: () => void };
  onTitleLayout?: (event: LayoutChangeEvent) => void;
}) {
  return (
    <>
      <Text
        accessibilityRole="header"
        className={
          small
            ? "mb-1 text-heading font-semibold tracking-[-0.3px]"
            : "mb-2 text-title font-semibold tracking-[-0.4px]"
        }
        onLayout={onTitleLayout}
      >
        {children}
      </Text>
      {subtitle ? (
        <Text
          className={`${action ? "" : small ? "mb-5 " : "mb-7 "}${small ? "text-body" : "text-subtitle"} text-ink-2`}
        >
          {subtitle}
        </Text>
      ) : null}
      {action ? (
        <View className="mt-2 mb-7 items-start">
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              Keyboard.dismiss();
              action.onPress();
            }}
            hitSlop={8}
            className="active:opacity-70"
          >
            <Text className="text-subtitle font-medium text-primary">{action.label}</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );
}
