import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isRTL } from "@/lib/language";
import { BackButton } from "./nav";

// A page with back at the top that scrolls the whole height of the screen, under a white bar,
// the way the booking page does: a hairline fades in under the bar once something's beneath it,
// and pulling down bounces the page under the bar rather than opening a gap below it. `footer`
// is what's pinned over the bottom (a bar, a sheet); `bottom` is the room kept for it.

const ROW = 40;
// From the top of the safe area to the back button, and from it to the bar's edge.
const ABOVE = 8;
const BELOW = 8;
// From the back button's row to the page's first line.
const TO_CONTENT = 10;

export function ScrollPage({
  right,
  bottom,
  footer,
  children,
}: {
  // At the end of the bar (share, say).
  right?: ReactNode;
  bottom: number;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const row = insets.top + ABOVE;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const hairline = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 12], [0, 1], "clamp"),
  }));

  return (
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <StatusBar style="dark" />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: row + ROW + TO_CONTENT,
          paddingHorizontal: 24,
          paddingBottom: bottom,
        }}
      >
        {children}
      </Animated.ScrollView>

      {/* The bar: back (and what's at its end), over the page. */}
      <View
        className="absolute top-0 right-0 left-0 bg-white px-5"
        style={{ height: row + ROW + BELOW, paddingTop: row }}
      >
        <View className="-mx-1 flex-row items-center justify-between" style={{ height: ROW }}>
          <BackButton onPress={() => router.back()} />
          {right}
        </View>
        <Animated.View
          className="absolute right-0 bottom-0 left-0 h-px bg-hairline"
          style={hairline}
        />
      </View>

      {footer}
    </View>
  );
}
