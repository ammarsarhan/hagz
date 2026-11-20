import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { hourLabel } from "@/lib/search";
import { Text } from "./text";

// The When sheet's timeline (Figma "C3 · Tabs & Search", section "Search · When sheet", option 4,
// 122:2; the user's pick on 2026-11-20): the day from 6 am to midnight as bars, one an hour, as
// tall as the number of venues free to start then, over a track with the game's run between two
// handles. Drag a handle to move that end an hour at a time (with a tick), or press between the
// handles of a run two or more hours long and drag to slide it; tap the timeline to move the run
// there (or, with nothing picked, to pick that hour). The run is 1 to 6 hours.

export interface Run {
  from: number; // First hour, 0–23.
  to: number; // The hour it ends (exclusive), 1–24.
}

const FIRST = 6;
const LAST = 24;
const SPAN = LAST - FIRST;
const LONGEST = 6;
const BARS = 56;
const HANDLE = 26;

const INK = "#0b0b0c";
const OFF = "#d5d8dd";
const PAST = "#edeef0";

// "8 – 11 pm", "11 am – 1 pm".
export const runLabel = (run: Run) => {
  const from = hourLabel(run.from % 24);
  const to = hourLabel(run.to % 24);
  const sameHalf = run.from < 12 === run.to % 24 < 12 && run.to !== 24;
  return sameHalf ? `${from.replace(/ [ap]m$/, "")} – ${to}` : `${from} – ${to}`;
};

// An hour's bar: grey (faint when past), its black fading in as the run takes it in and out as it
// leaves, so moving a handle sweeps rather than snaps. Its height follows the day's count: growing
// after `delay` (so a new day's bars rise left to right), shrinking at once.
function Bar({
  height,
  picked,
  past,
  delay,
}: {
  height: number;
  picked: boolean;
  past: boolean;
  delay: number;
}) {
  const shown = useSharedValue(picked ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(picked ? 1 : 0, { duration: 100 });
  }, [picked, shown]);
  const tall = useSharedValue(height);
  useEffect(() => {
    tall.value =
      height > tall.value
        ? withDelay(delay, withTiming(height, { duration: 320, easing: Easing.out(Easing.cubic) }))
        : withTiming(height, { duration: 120 });
  }, [height, delay, tall]);
  const fill = useAnimatedStyle(() => ({ opacity: shown.value }));
  const size = useAnimatedStyle(() => ({ height: tall.value }));
  return (
    <Animated.View
      style={[{ borderRadius: 2, backgroundColor: past ? PAST : OFF, overflow: "hidden" }, size]}
    >
      <Animated.View
        style={[
          { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: INK },
          fill,
        ]}
      />
    </Animated.View>
  );
}

// Each bar of a new day starts growing this long after the one before it.
const GROW_STAGGER = 22;
// How close to a handle a touch has to land to take it, rather than the run between them.
const GRAB = HANDLE / 2 + 10;

export function HourTimeline({
  counts,
  run,
  earliest,
  onChange,
}: {
  // Venues free to start at each hour 0–23; null while they load.
  counts: number[] | null;
  run: Run | null;
  // The first hour that can still be picked (today, the next hour; another day, 6 am).
  earliest: number;
  onChange: (run: Run | null) => void;
}) {
  const [width, setWidth] = useState(0);
  const cell = width / SPAN;
  const most = Math.max(1, ...(counts ?? []).slice(FIRST, LAST));
  const lowest = Math.max(FIRST, earliest);

  // The run's ends in points, moved on the UI thread: stepping hour by hour with the finger (a quick
  // glide to each new hour), and gliding when the run changes from outside (a tap, a new day). The
  // run itself, which the bars, the label and the search read, changes at the same moments.
  const fromX = useSharedValue(0);
  const toX = useSharedValue(0);
  const shown = useSharedValue(run ? 1 : 0);
  const cellSV = useSharedValue(cell);
  const lowestSV = useSharedValue(lowest);
  const dragging = useSharedValue(false);
  useEffect(() => {
    cellSV.value = cell;
    lowestSV.value = lowest;
  }, [cell, lowest, cellSV, lowestSV]);
  useEffect(() => {
    shown.value = run ? 1 : 0;
    if (!run || cell === 0 || dragging.value) return;
    const from = (run.from - FIRST) * cell;
    const to = (run.to - FIRST) * cell;
    // The first time there's a run to show, it's simply there; after that it glides.
    if (toX.value === 0) {
      fromX.value = from;
      toX.value = to;
      return;
    }
    const glide = { duration: 140, easing: Easing.out(Easing.cubic) };
    fromX.value = withTiming(from, glide);
    toX.value = withTiming(to, glide);
    // `run` is read through its two numbers, so a new object for the same run doesn't glide.
  }, [run?.from, run?.to, cell]);

  const commit = (from: number, to: number) => {
    void Haptics.selectionAsync();
    onChange({ from, to });
  };

  // What's held: 1 the start's handle, 2 the end's, 3 the whole run (pressed between the handles
  // of a run two hours or more wide). Where it all was when the finger went down, and the run last
  // committed.
  const held = useSharedValue(0);
  const startX = useSharedValue(0);
  const startFrom = useSharedValue(0);
  const startTo = useSharedValue(0);
  const lastFrom = useSharedValue(0);
  const lastTo = useSharedValue(0);

  const drag = Gesture.Pan()
    .minDistance(2)
    .onBegin((event) => {
      const c = cellSV.value;
      if (shown.value === 0 || c === 0) {
        held.value = 0;
        return;
      }
      const toFrom = Math.abs(event.x - fromX.value);
      const toTo = Math.abs(event.x - toX.value);
      const inside = event.x > fromX.value && event.x < toX.value;
      const wide = Math.round((toX.value - fromX.value) / c) >= 2;
      held.value = inside && wide && Math.min(toFrom, toTo) > GRAB ? 3 : toFrom <= toTo ? 1 : 2;
      startX.value = event.x;
      startFrom.value = fromX.value;
      startTo.value = toX.value;
      lastFrom.value = Math.round(fromX.value / c) + FIRST;
      lastTo.value = Math.round(toX.value / c) + FIRST;
      dragging.value = true;
    })
    .onUpdate((event) => {
      const c = cellSV.value;
      if (held.value === 0 || c === 0) return;
      // Where the finger would put the ends, in hours, then kept to the rules: the whole run slid
      // (length kept), or one end moved (1 to LONGEST hours, never before the earliest hour).
      const dx = Math.round((event.x - startX.value) / c);
      const first = Math.round(startFrom.value / c) + FIRST;
      const last = Math.round(startTo.value / c) + FIRST;
      const least = lowestSV.value;
      let from = lastFrom.value;
      let to = lastTo.value;
      if (held.value === 3) {
        const span = last - first;
        from = Math.min(Math.max(first + dx, least), LAST - span);
        to = from + span;
      } else if (held.value === 1) {
        from = Math.min(Math.max(first + dx, least, lastTo.value - LONGEST), lastTo.value - 1);
      } else {
        to = Math.max(Math.min(last + dx, LAST, lastFrom.value + LONGEST), lastFrom.value + 1);
      }
      // Hour by hour: the handles step to the new hours with a quick glide, and the run (the
      // bars, the label, the count) changes at the same moment.
      if (from !== lastFrom.value || to !== lastTo.value) {
        const step = { duration: 90, easing: Easing.out(Easing.cubic) };
        if (from !== lastFrom.value) fromX.value = withTiming((from - FIRST) * c, step);
        if (to !== lastTo.value) toX.value = withTiming((to - FIRST) * c, step);
        lastFrom.value = from;
        lastTo.value = to;
        runOnJS(commit)(from, to);
      }
    })
    .onFinalize(() => {
      held.value = 0;
      dragging.value = false;
    });

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event) => {
      const hour = Math.min(Math.max(Math.floor(event.x / cell) + FIRST, lowest), LAST - 1);
      const length = run ? run.to - run.from : 1;
      const from = Math.min(hour, LAST - length);
      if (from < lowest) return;
      commit(from, from + length);
    });

  const segment = useAnimatedStyle(() => ({
    opacity: shown.value,
    left: fromX.value,
    width: toX.value - fromX.value,
  }));
  const startHandle = useAnimatedStyle(() => ({
    opacity: shown.value,
    left: fromX.value - HANDLE / 2,
  }));
  const endHandle = useAnimatedStyle(() => ({
    opacity: shown.value,
    left: toX.value - HANDLE / 2,
  }));
  const handle = {
    width: HANDLE,
    height: HANDLE,
    shadowColor: INK,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  };

  return (
    // Sized by what's in it: the root view flexes by default, and in a sheet sized by its content
    // that leaves it no height, so the timeline spilled under the buttons.
    <GestureHandlerRootView style={{ flex: 0 }}>
      <GestureDetector gesture={Gesture.Exclusive(drag, tap)}>
        <View
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={{ paddingTop: 4 }}
        >
          {/* Bars: venues free to start each hour. */}
          <View className="flex-row items-end" style={{ height: BARS }}>
            {Array.from({ length: SPAN }, (_, i) => {
              const hour = FIRST + i;
              const venues = counts?.[hour] ?? 0;
              const picked = run !== null && hour >= run.from && hour < run.to;
              const past = hour < lowest;
              return (
                <View key={hour} style={{ width: cell, paddingHorizontal: 1.5 }}>
                  <Bar
                    height={counts ? Math.max(3, (venues / most) * BARS) : 3}
                    picked={picked && !past}
                    past={past}
                    delay={i * GROW_STAGGER}
                  />
                </View>
              );
            })}
          </View>
          {/* The track and the run on it, with its handles. */}
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
          <View className="flex-row justify-between">
            {[6, 12, 18, 24].map((hour) => (
              <Text key={hour} className="text-[11px] leading-[14px] text-unit">
                {hourLabel(hour % 24).replace(" ", "")}
              </Text>
            ))}
          </View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
