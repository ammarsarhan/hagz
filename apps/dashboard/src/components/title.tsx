import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./text";

// The big start-aligned title (28/34, 600) and its grey subtitle, which can hold inline links. An
// `action` (such as "Change" under the number a code went to) gets its own line under the subtitle,
// so it never wraps onto the end of the sentence.
export function Title({
  children,
  subtitle,
  action,
}: {
  children: string;
  subtitle?: ReactNode;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <>
      <Text accessibilityRole="header" className="mb-2 text-title font-semibold tracking-[-0.4px]">
        {children}
      </Text>
      {subtitle ? (
        <Text className={`${action ? "" : "mb-7 "}text-subtitle text-ink-2`}>{subtitle}</Text>
      ) : null}
      {action ? (
        <View className="mt-2 mb-7 items-start">
          <Pressable
            accessibilityRole="button"
            onPress={action.onPress}
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
