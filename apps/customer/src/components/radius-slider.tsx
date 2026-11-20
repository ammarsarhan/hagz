import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { MAX_RADIUS } from "@/lib/search";
import { Text } from "./text";

// Where's radius (Figma "C3 · Tabs & Search" C1, 135:2; smooth, user 2026-11-20): 1 to 50 km, a
// bar per kilometre as tall as how many venues lie within it, black up to the radius. The handle
// follows the finger on the UI thread; the radius (and the label and count it drives) changes a
// kilometre at a time, with a tick.

const BARS = 56;
const HANDLE = 26;
const INK = "#0b0b0c";
const OFF = "#d5d8dd";

function Bar({ height, on }: { height: number; on: boolean }) {
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
}

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
  const [width, setWidth] = useState(0);
  const step = width / (MAX_RADIUS - 1);
  const most = Math.max(1, ...(within ?? []));

  const x = useSharedValue(0);
  const stepSV = useSharedValue(step);
  const last = useSharedValue(radius);
  const start = useSharedValue(0);
  const dragging = useSharedValue(false);
  useEffect(() => {
    stepSV.value = step;
    if (!dragging.value) x.value = (radius - 1) * step;
  }, [step, radius, stepSV, x, dragging]);

  const commit = (km: number) => {
    void Haptics.selectionAsync();
    onChange(km);
  };

  const move = (to: number) => {
    "worklet";
    const s = stepSV.value;
    if (s === 0) return;
    x.value = Math.min(Math.max(to, 0), (MAX_RADIUS - 1) * s);
    const km = Math.round(x.value / s) + 1;
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
      move(start.value + event.translationX);
    })
    .onFinalize(() => {
      dragging.value = false;
    });
  const tap = Gesture.Tap().onEnd((event) => {
    move(event.x);
  });

  const handle = useAnimatedStyle(() => ({ left: x.value - HANDLE / 2 }));
  const segment = useAnimatedStyle(() => ({ width: x.value }));

  return (
    <GestureHandlerRootView style={{ flex: 0 }}>
      <GestureDetector gesture={Gesture.Exclusive(drag, tap)}>
        <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          <View className="flex-row items-end justify-between" style={{ height: BARS }}>
            {Array.from({ length: MAX_RADIUS }, (_, i) => (
              <View key={i} style={{ width: Math.max(1, step - 2) }}>
                <Bar
                  height={within ? Math.max(2, ((within[i] ?? 0) / most) * BARS) : 2}
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
          <View className="flex-row justify-between">
            {[1, 10, 20, 30, 40, 50].map((km) => (
              <Text key={km} className="text-[11px] leading-[14px] text-unit">
                {km} km
              </Text>
            ))}
          </View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
