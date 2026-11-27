import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./text";

// A round grey 40 pt button beside a tab's title (the Calendar's inbox and +, Home's scan and
// notifications), with an optional red count on its corner (none at 0).
export function HeaderButton({
  label,
  onPress,
  badge = 0,
  children,
}: {
  label: string;
  onPress: () => void;
  badge?: number;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      className="size-10 items-center justify-center rounded-full bg-chip active:opacity-70"
    >
      {children}
      {badge > 0 ? (
        <View
          className="absolute h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red px-1"
          style={{ top: -5, end: -6 }}
        >
          <Text className="text-[11px] leading-[14px] font-semibold text-white">
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
