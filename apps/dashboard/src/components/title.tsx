import type { ReactNode } from "react";
import { Keyboard, Pressable, View, type LayoutChangeEvent } from "react-native";
import { Text } from "./text";

// The big start-aligned title (28/34, 600) and its grey subtitle, which can hold inline links. An
// `action` (such as "Change" under the number a code went to) gets its own line under the subtitle,
// so it never wraps onto the end of the sentence. `onTitleLayout` says where the title itself sits,
// for a screen that shows it again in the nav bar once it's scrolled away.
export function Title({
  children,
  subtitle,
  action,
  onTitleLayout,
}: {
  children: string;
  subtitle?: ReactNode;
  action?: { label: string; onPress: () => void };
  onTitleLayout?: (event: LayoutChangeEvent) => void;
}) {
  return (
    <>
      <Text
        accessibilityRole="header"
        className="mb-2 text-title font-semibold tracking-[-0.4px]"
        onLayout={onTitleLayout}
      >
        {children}
      </Text>
      {subtitle ? (
        <Text className={`${action ? "" : "mb-7 "}text-subtitle text-ink-2`}>{subtitle}</Text>
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
