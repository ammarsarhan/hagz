import * as Haptics from "expo-haptics";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { isRTL } from "@/lib/language";
import { MAX_RADIUS } from "@/lib/search";
import { Text } from "./text";

// Where's radius (Figma "C3 · Tabs & Search" C1, 135:2; smooth, user 2026-11-20): 1 to 50 km, a
// bar per kilometre as tall as how many venues lie that far (not within it, which made a wall once
// every venue was inside), black up to the radius. The handle
// follows the finger on the UI thread; the radius (and the label and count it drives) changes a
// kilometre at a time, with a tick. In Arabic it runs right to left, nearest on the right.

const BARS = 56;
const HANDLE = 26;
const INK = "#0b0b0c";
const OFF = "#d5d8dd";

// Memoised: a kilometre crossed redraws only the bar it turns black or grey.
const Bar = memo(function Bar({ height, on }: { height: number; on: boolean }) {
  const shown = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(on ? 1 : 0, { duration: 100 });
  }, [on, shown]);
  const tall = useSharedValue(height);
  useEffect(() => {
    tall.value = withTiming(height, { duration: 220 });
  }, [height, tall]);
  const fill = useAnimatedStyle(() => ({ opacity: shown.value }));
  const size = useAnimatedStyle(() => ({ height: tall.value }));
  return (
    <Animated.View style={[{ borderRadius: 1.5, backgroundColor: OFF, overflow: "hidden" }, size]}>
      <Animated.View
        style={[
          { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: INK },
          fill,
        ]}
      />
    </Animated.View>
  );
});

export function RadiusSlider({
  radius,
  within,
  onChange,
}: {
  radius: number;
  // How many venues lie within 1 km, 2 km… 50 km; null while they load.
  within: number[] | null;
  onChange: (radius: number) => void;
}) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  // A cell a kilometre, as the When timeline lays out hours: the handle sits on the end of the last
  // black bar, so the bars and the handle line up all along.
  const cell = width / MAX_RADIUS;
  // A bar a kilometre: the venues between it and the one before (the API counts within each).
  const at = (within ?? []).map((count, i) => count - (i > 0 ? (within?.[i - 1] ?? 0) : 0));
  const most = Math.max(1, ...at);

  const x = useSharedValue(0);
  const cellSV = useSharedValue(cell);
  const last = useSharedValue(radius);
  const start = useSharedValue(0);
  const dragging = useSharedValue(false);
  // Hidden (its space kept) until it's measured and the handle's on the radius, so the first
  // frames, drawn at no width, never show: then it fades in.
  const ready = useSharedValue(0);
  useEffect(() => {
    cellSV.value = cell;
    if (!dragging.value) {
      x.value = radius * cell;
      last.value = radius;
    }
    if (cell > 0 && ready.value === 0) ready.value = withTiming(1, { duration: 160 });
  }, [cell, radius, cellSV, x, last, dragging, ready]);
  const shown = useAnimatedStyle(() => ({ opacity: ready.value }));

  const commit = (km: number) => {
    void Haptics.selectionAsync();
    onChange(km);
  };

  const move = (to: number) => {
    "worklet";
    const c = cellSV.value;
    if (c === 0) return;
    x.value = Math.min(Math.max(to, c), MAX_RADIUS * c);
    const km = Math.min(Math.max(Math.round(x.value / c), 1), MAX_RADIUS);
    if (km !== last.value) {
      last.value = km;
      runOnJS(commit)(km);
    }
  };

  // Sideways only: a vertical swipe that starts here scrolls what it's in.
  const drag = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-8, 8])
    .onBegin(() => {
      start.value = x.value;
      dragging.value = true;
    })
    .onUpdate((event) => {
      // Dragging towards the end: right in English, left in Arabic.
      move(start.value + event.translationX * (isRTL ? -1 : 1));
    })
    .onFinalize(() => {
      // Settles on the end of the kilometre it's on.
      x.value = withTiming(last.value * cellSV.value, { duration: 120 });
      dragging.value = false;
    });
  // A tap takes the bar under it.
  const tap = Gesture.Tap().onEnd((event) => {
    const c = cellSV.value;
    if (c === 0) return;
    // Measured from the left; the kilometres run from the start.
    const x = isRTL ? MAX_RADIUS * c - event.x : event.x;
    move((Math.floor(x / c) + 1) * c);
  });

  const handle = useAnimatedStyle(() => ({ left: x.value - HANDLE / 2 }));
  const segment = useAnimatedStyle(() => ({ width: x.value }));
  const TICK = 44;

  return (
    <GestureHandlerRootView style={{ flex: 0 }}>
      <GestureDetector gesture={Gesture.Exclusive(drag, tap)}>
        <Animated.View style={shown} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          <View className="flex-row items-end" style={{ height: BARS }}>
            {Array.from({ length: MAX_RADIUS }, (_, i) => (
              <View key={i} style={{ width: cell, paddingHorizontal: cell > 5 ? 1 : 0.5 }}>
                <Bar
                  height={within ? Math.max(2, ((at[i] ?? 0) / most) * BARS) : 2}
                  on={i + 1 <= radius}
                />
              </View>
            ))}
          </View>
          <View style={{ height: HANDLE + 8, justifyContent: "center" }}>
            <View className="h-1 rounded-full bg-chip" />
            <Animated.View className="absolute h-1 rounded-full bg-ink" style={segment} />
            <Animated.View
              className="absolute rounded-full border-2 border-ink bg-white"
              style={[
                {
                  width: HANDLE,
                  height: HANDLE,
                  shadowColor: INK,
                  shadowOpacity: 0.12,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                },
                handle,
              ]}
            />
          </View>
          {/* Each under its own bar. */}
          <View style={{ height: 14 }}>
            {[1, 10, 20, 30, 40, 50].map((km) => (
              <Text
                key={km}
                className="absolute text-center text-[11px] leading-[14px] text-unit"
                style={{
                  width: TICK,
                  left: Math.min(Math.max((km - 0.5) * cell - TICK / 2, 0), width - TICK),
                }}
              >
                {t("formats.km", { value: km })}
              </Text>
            ))}
          </View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
