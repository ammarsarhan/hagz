import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/lib/colors";
import { Text } from "./text";

// A booking's bar pinned at the bottom (Figma D8 530:2, D9 606:76): under a hairline, what the
// booking is waiting on with a grey line under it on the left, and its actions on the right. Goes in
// Screen's footer, whose 20px sides the hairline reaches past.
export function BottomBar({
  title,
  detail,
  medium = false,
  children,
}: {
  title: string;
  // The title in medium (a new booking's "Karim Adel · 900 EGP").
  medium?: boolean;
  // A string, or a node of its own (a link: "Add a note").
  detail?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View>
      <View className="-mx-5 -mt-3 mb-3 h-px bg-border" />
      <View className="flex-row items-center">
        <View className="me-3 flex-1">
          <Text className={`text-subtitle ${medium ? "font-medium" : ""}`}>{title}</Text>
          {typeof detail === "string" ? (
            <Text className="text-caption text-ink-2">{detail}</Text>
          ) : (
            detail
          )}
        </View>
        <View className="flex-row gap-2">{children}</View>
      </View>
    </View>
  );
}

// The bar's pill: blue for the step forward, white with a hairline for the other way. `incomplete`:
// not ready yet (a pick too short to hold), grey and breathing slowly, and does nothing.
const PULSE_MS = 900;

export function BarButton({
  label,
  onPress,
  primary = false,
  busy = false,
  incomplete = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  busy?: boolean;
  incomplete?: boolean;
}) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (incomplete)
      pulse.value = withRepeat(
        withTiming(0.5, { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 150 });
    }
    return () => cancelAnimation(pulse);
  }, [incomplete, pulse]);
  const pulsing = useAnimatedStyle(() => ({ opacity: pulse.value }));
  if (incomplete)
    return (
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: true }}
        className="h-12 min-w-24 items-center justify-center rounded-full bg-field px-5"
        style={pulsing}
      >
        <Text className="text-body font-semibold text-ink-3">{label}</Text>
      </Animated.View>
    );
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
