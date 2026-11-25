import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/colors";

// The tabs' pull to refresh (the customer app's Search and Bookings, and here the Calendar): the list locks down with a small spinner showing,
// Instagram's way, until what it started comes back, and for at least HOLD_MS (a quick answer
// would otherwise snap it straight back up, user 2026-11-20). A light tap in the hand as the pull
// catches. The system's spinner can't be made smaller, so it's hidden and `spinner` shows instead:
// put it over the list, after it.

const HOLD_MS = 800;

export function usePullToRefresh({
  scrollY,
  busy,
  onRefresh,
}: {
  // The list's scroll offset, to fade the spinner in as it's pulled past the top.
  scrollY: SharedValue<number>;
  // Whether what the pull started is still loading.
  busy: boolean;
  onRefresh: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [pulled, setPulled] = useState(false);
  const pulledAt = useRef(0);
  const pulling = useSharedValue(0);

  useEffect(() => {
    if (!pulled || busy) return;
    const timer = setTimeout(
      () => setPulled(false),
      Math.max(0, HOLD_MS - (Date.now() - pulledAt.current)),
    );
    return () => clearTimeout(timer);
  }, [pulled, busy]);
  useEffect(() => {
    pulling.value = withTiming(pulled ? 1 : 0, { duration: 180 });
  }, [pulled, pulling]);

  const spinnerStyle = useAnimatedStyle(() => ({
    opacity: Math.max(pulling.value, interpolate(-scrollY.value, [10, 60], [0, 1], "clamp")),
  }));

  const control = (
    <RefreshControl
      refreshing={pulled}
      onRefresh={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        pulledAt.current = Date.now();
        setPulled(true);
        onRefresh();
      }}
      tintColor="transparent"
      colors={["transparent"]}
      progressBackgroundColor="transparent"
      progressViewOffset={insets.top}
    />
  );

  const spinner = (
    <Animated.View
      pointerEvents="none"
      className="absolute right-0 left-0 items-center"
      style={[{ top: insets.top + 14 }, spinnerStyle]}
    >
      <ActivityIndicator size="small" color={colors.ink} style={{ transform: [{ scale: 0.95 }] }} />
    </Animated.View>
  );

  return { control, spinner };
}
