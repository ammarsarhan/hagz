import * as Haptics from "expo-haptics";
import { memo, useEffect, useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { isRTL } from "@/lib/language";

// A range over bars (the Filters sheet's price per hour, Figma "C3 · Tabs & Search" A1, 127:2):
// one bar a band, as tall as how many venues fall in it, black inside the range, under a track with
// two handles. Like the When sheet's timeline: a handle steps a band at a time under the finger
// (a quick glide, a tick), and the bars change at the same moment. At least one band is picked.
// In Arabic the bands run right to left, cheapest on the right.

const BARS = 56;
const HANDLE = 26;
const INK = "#0b0b0c";
const OFF = "#d5d8dd";

export interface Range {
  from: number; // The first band picked.
  to: number; // The band after the last one picked.
}

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
    <Animated.View style={[{ borderRadius: 2, backgroundColor: OFF, overflow: "hidden" }, size]}>
      <Animated.View
        style={[
          { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: INK },
          fill,
        ]}
      />
    </Animated.View>
  );
});

export function RangeBars({
  counts,
  range,
  onChange,
}: {
  counts: number[];
  range: Range;
  onChange: (range: Range) => void;
}) {
  const [width, setWidth] = useState(0);
  const bands = counts.length;
  const cell = bands > 0 ? width / bands : 0;
  const most = Math.max(1, ...counts);

  // Touches are measured from the left; the bands run from the start, the right in Arabic.
  const widthSV = useSharedValue(width);
  useEffect(() => {
    widthSV.value = width;
  }, [width, widthSV]);
  const along = (x: number) => {
    "worklet";
    return isRTL ? widthSV.value - x : x;
  };

  const fromX = useSharedValue(range.from * cell);
  const toX = useSharedValue(range.to * cell);
  const cellSV = useSharedValue(cell);
  const bandsSV = useSharedValue(bands);
  const dragging = useSharedValue(false);
  useEffect(() => {
    cellSV.value = cell;
    bandsSV.value = bands;
    if (dragging.value) return;
    const glide = { duration: 140, easing: Easing.out(Easing.cubic) };
    fromX.value = withTiming(range.from * cell, glide);
    toX.value = withTiming(range.to * cell, glide);
  }, [range.from, range.to, cell, bands, cellSV, bandsSV, fromX, toX, dragging]);

  const commit = (from: number, to: number) => {
    void Haptics.selectionAsync();
    onChange({ from, to });
  };

  // 1 the start's handle, 2 the end's; where they were when the finger went down.
  const held = useSharedValue(0);
  const startX = useSharedValue(0);
  const first = useSharedValue(0);
  const last = useSharedValue(0);
  const nowFrom = useSharedValue(0);
  const nowTo = useSharedValue(0);

  // Sideways only: a vertical swipe that starts here scrolls what it's in.
  const drag = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-8, 8])
    .onBegin((event) => {
      const c = cellSV.value;
      if (c === 0) return;
      const x = along(event.x);
      held.value = Math.abs(x - fromX.value) <= Math.abs(x - toX.value) ? 1 : 2;
      startX.value = x;
      first.value = Math.round(fromX.value / c);
      last.value = Math.round(toX.value / c);
      nowFrom.value = first.value;
      nowTo.value = last.value;
      dragging.value = true;
    })
    .onUpdate((event) => {
      const c = cellSV.value;
      if (held.value === 0 || c === 0) return;
      const moved = Math.round((along(event.x) - startX.value) / c);
      const from = nowFrom.value;
      const to = nowTo.value;
      let nextFrom = from;
      let nextTo = to;
      if (held.value === 1) nextFrom = Math.min(Math.max(first.value + moved, 0), to - 1);
      else nextTo = Math.max(Math.min(last.value + moved, bandsSV.value), from + 1);
      if (nextFrom !== from || nextTo !== to) {
        const step = { duration: 90, easing: Easing.out(Easing.cubic) };
        if (nextFrom !== from) fromX.value = withTiming(nextFrom * c, step);
        if (nextTo !== to) toX.value = withTiming(nextTo * c, step);
        nowFrom.value = nextFrom;
        nowTo.value = nextTo;
        runOnJS(commit)(nextFrom, nextTo);
      }
    })
    .onFinalize(() => {
      held.value = 0;
      dragging.value = false;
    });

  const segment = useAnimatedStyle(() => ({ left: fromX.value, width: toX.value - fromX.value }));
  const startHandle = useAnimatedStyle(() => ({ left: fromX.value - HANDLE / 2 }));
  const endHandle = useAnimatedStyle(() => ({ left: toX.value - HANDLE / 2 }));
  const handle = {
    width: HANDLE,
    height: HANDLE,
    shadowColor: INK,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  };

  return (
    // Inside a Sheet, which holds the gesture root.
    <GestureDetector gesture={drag}>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <View className="flex-row items-end" style={{ height: BARS }}>
          {counts.map((count, i) => (
            <View key={i} style={{ width: cell, paddingHorizontal: 1.5 }}>
              <Bar
                height={Math.max(3, (count / most) * BARS)}
                on={i >= range.from && i < range.to}
              />
            </View>
          ))}
        </View>
        <View style={{ height: HANDLE + 8, justifyContent: "center" }}>
          <View className="h-1 rounded-full bg-chip" />
          <Animated.View className="absolute h-1 rounded-full bg-ink" style={segment} />
          <Animated.View
            className="absolute rounded-full border-2 border-ink bg-white"
            style={[handle, startHandle]}
          />
          <Animated.View
            className="absolute rounded-full border-2 border-ink bg-white"
            style={[handle, endHandle]}
          />
        </View>
      </View>
    </GestureDetector>
  );
}

// The chart with nothing to chart (no venue has a price for this search, or the prices are still
// on their way): the same height as RangeBars, its bars flat and grey over the bare track, with no
// handles, so the section keeps its shape instead of leaving a gap.
const EMPTY_BANDS = 20;

export function EmptyBars() {
  return (
    <View accessible={false}>
      <View className="flex-row items-end" style={{ height: BARS }}>
        {Array.from({ length: EMPTY_BANDS }, (_, i) => (
          <View key={i} className="flex-1" style={{ paddingHorizontal: 1.5 }}>
            <View style={{ height: 3, borderRadius: 2, backgroundColor: OFF }} />
          </View>
        ))}
      </View>
      <View style={{ height: HANDLE + 8, justifyContent: "center" }}>
        <View className="h-1 rounded-full bg-chip" />
      </View>
    </View>
  );
}
