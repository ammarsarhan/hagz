import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { colors } from "@/lib/colors";
import { Text } from "./text";

// A booking's bar pinned at the bottom (Figma D8 530:2, D9 606:76): under a hairline, what the
// booking is waiting on with a grey line under it on the left, and its actions on the right. Goes in
// Screen's footer, whose 20px sides the hairline reaches past.
export function BottomBar({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <View>
      <View className="-mx-5 -mt-3 mb-3 h-px bg-border" />
      <View className="flex-row items-center">
        <View className="me-3 flex-1">
          <Text className="text-subtitle">{title}</Text>
          {detail ? <Text className="text-caption text-ink-2">{detail}</Text> : null}
        </View>
        <View className="flex-row gap-2">{children}</View>
      </View>
    </View>
  );
}

// The bar's pill: blue for the step forward, white with a hairline for the other way.
export function BarButton({
  label,
  onPress,
  primary = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={onPress}
      className={`h-12 min-w-24 items-center justify-center rounded-full px-5 active:opacity-70 ${primary ? "bg-primary" : "border border-border bg-white"}`}
    >
      {busy ? (
        <ActivityIndicator color={primary ? colors.onPrimary : colors.ink3} />
      ) : (
        <Text className={`text-body font-semibold ${primary ? "text-on-primary" : ""}`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
