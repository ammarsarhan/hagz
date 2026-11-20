import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { hourLabel } from "@/lib/search";
import { Text } from "./text";

// The When sheet's timeline (Figma "C3 · Tabs & Search", section "Search · When sheet", option 4,
// 122:2; the user's pick on 2026-11-20): the day from 6 am to midnight as bars, one an hour, as
// tall as the number of venues free to start then, over a track with the game's run between two
// handles. Drag a handle to move that end an hour at a time (with a tick); tap the timeline to move
// the run there (or, with nothing picked, to pick that hour). The run is 1 to 6 hours.

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
// leaves, so moving a handle sweeps rather than snaps.
function Bar({ height, picked, past }: { height: number; picked: boolean; past: boolean }) {
  const shown = useSharedValue(picked ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(picked ? 1 : 0, { duration: 160 });
  }, [picked, shown]);
  const fill = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <View
      style={{ height, borderRadius: 2, backgroundColor: past ? PAST : OFF, overflow: "hidden" }}
    >
      <Animated.View
        style={[
          { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: INK },
          fill,
        ]}
      />
    </View>
  );
}

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
  const xOf = (hour: number) => (hour - FIRST) * cell;
  const hourAt = (x: number) => Math.round(x / cell) + FIRST;
  const most = Math.max(1, ...(counts ?? []).slice(FIRST, LAST));
  const lowest = Math.max(FIRST, earliest);

  // Which end is being dragged, and the run when the drag began.
  const dragging = useRef<{ end: "from" | "to"; run: Run } | null>(null);
  const last = useRef<Run | null>(null);
  const set = (next: Run) => {
    if (last.current && last.current.from === next.from && last.current.to === next.to) return;
    last.current = next;
    void Haptics.selectionAsync();
    onChange(next);
  };

  const drag = Gesture.Pan()
    .runOnJS(true)
    .minDistance(2)
    .onBegin((event) => {
      if (!run) return;
      // The nearer handle.
      const end =
        Math.abs(event.x - xOf(run.from)) <= Math.abs(event.x - xOf(run.to)) ? "from" : "to";
      dragging.current = { end, run };
      last.current = run;
    })
    .onUpdate((event) => {
      const held = dragging.current;
      if (!held) return;
      const hour = hourAt(event.x);
      if (held.end === "from") {
        const from = Math.min(Math.max(hour, lowest, held.run.to - LONGEST), held.run.to - 1);
        set({ from, to: held.run.to });
      } else {
        const to = Math.max(Math.min(hour, LAST, held.run.from + LONGEST), held.run.from + 1);
        set({ from: held.run.from, to });
      }
    })
    .onFinalize(() => {
      dragging.current = null;
    });

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event) => {
      const hour = Math.min(Math.max(Math.floor(event.x / cell) + FIRST, lowest), LAST - 1);
      const length = run ? run.to - run.from : 1;
      const from = Math.min(hour, LAST - length);
      if (from < lowest) return;
      last.current = { from, to: from + length };
      void Haptics.selectionAsync();
      onChange({ from, to: from + length });
    });

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
                  />
                </View>
              );
            })}
          </View>
          {/* The track and the run on it, with its handles. */}
          <View style={{ height: HANDLE + 8, justifyContent: "center" }}>
            <View className="h-1 rounded-full bg-chip" />
            {run && width > 0 ? (
              <>
                <View
                  className="absolute h-1 rounded-full bg-ink"
                  style={{ left: xOf(run.from), width: xOf(run.to) - xOf(run.from) }}
                />
                {[run.from, run.to].map((hour, k) => (
                  <View
                    key={k}
                    className="absolute rounded-full border-2 border-ink bg-white"
                    style={{
                      width: HANDLE,
                      height: HANDLE,
                      left: xOf(hour) - HANDLE / 2,
                      shadowColor: INK,
                      shadowOpacity: 0.12,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                    }}
                  />
                ))}
              </>
            ) : null}
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
