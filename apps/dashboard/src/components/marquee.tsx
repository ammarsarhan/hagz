import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { isRTL } from "@/lib/language";
import { Text } from "./text";

// One line that scrolls when it doesn't fit (user, 2026-11-26: Regulars' new order in its bar):
// still at its start for a moment, then slowly along to its end, a pause, and back to the start.
// It fits: it just sits there. Arabic scrolls the other way, from its start on the right.

// How fast it moves along, in points a second, and how long it rests at each end.
const SPEED = 30;
const REST_MS = 1400;
const BACK_MS = 450;

export function Marquee({ text, className }: { text: string; className: string }) {
  const [room, setRoom] = useState(0);
  const [width, setWidth] = useState(0);
  const shift = useSharedValue(0);
  const over = Math.max(0, width - room);

  useEffect(() => {
    cancelAnimation(shift);
    shift.value = 0;
    if (over <= 0 || room === 0) return;
    const to = isRTL ? over : -over;
    shift.value = withRepeat(
      withSequence(
        withDelay(
          REST_MS,
          withTiming(to, { duration: (over / SPEED) * 1000, easing: Easing.linear }),
        ),
        withDelay(REST_MS, withTiming(0, { duration: BACK_MS, easing: Easing.out(Easing.cubic) })),
      ),
      -1,
    );
    return () => cancelAnimation(shift);
  }, [over, room, shift]);

  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));

  return (
    <View
      className="overflow-hidden"
      onLayout={(event) => setRoom(event.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={text}
    >
      {/* Laid out at its own width, however long, inside a scroll view that never scrolls. */}
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={isRTL ? { flexGrow: 1, justifyContent: "flex-end" } : undefined}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Animated.View
          style={moving}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        >
          <Text className={className} numberOfLines={1}>
            {text}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
