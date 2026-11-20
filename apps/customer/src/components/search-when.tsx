import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Pressable, ScrollView, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { hourLabel, localDate, type SearchParams, type When, useVenueCount } from "@/lib/search";
import { Button } from "./button";
import { Sheet } from "./sheet";
import { Text } from "./text";

// When to play (Figma "C3 · Tabs & Search", option 5, 100:2): a sheet over Search with the next two
// weeks as day tiles and the start as a run of hours (user, 2026-11-20): tap an hour, then another,
// and every hour between fills in one after the other; the run is the game's start and length.
// Tap an end to shrink it, a middle hour to start again from it, a lone hour (or Any) to clear it;
// or drag across the hours to pick a run in one go.
// The button says how many venues the choice finds before it's applied; Clear goes back to today,
// any time.

const DAYS = 14;
// The longest game a search can ask for (the API's limit).
const LONGEST = 6;
// Each newly filled hour starts its fade this much after the one before it.
const STAGGER = 45;
// The earliest start offered on a day that isn't today.
const FIRST_HOUR = 6;

function DayTile({
  date,
  timezone,
  on,
  onPress,
}: {
  date: string;
  timezone: string;
  on: boolean;
  onPress: () => void;
}) {
  const today = date === localDate(timezone);
  const at = new Date(`${date}T12:00:00Z`);
  const weekday = today
    ? "Today"
    : new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" }).format(at);
  const day = at.getUTCDate();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={`h-[72px] w-[58px] items-center justify-center gap-0.5 rounded-[14px] ${on ? "bg-ink" : "border border-border bg-white"}`}
    >
      <Text className={`text-caption ${on ? "text-white" : "text-ink-2"}`}>{weekday}</Text>
      <Text className={`text-[20px] leading-6 font-medium ${on ? "text-white" : "text-ink"}`}>
        {day}
      </Text>
    </Pressable>
  );
}

// An hour, or Any: picked, its black fades in over the white one, after `delay`.
function Pill({
  label,
  on,
  delay = 0,
  onPress,
  onLayout,
}: {
  label: string;
  on: boolean;
  delay?: number;
  onPress: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const shown = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    shown.value = on
      ? withDelay(delay, withTiming(1, { duration: 160 }))
      : withTiming(0, { duration: 140 });
  }, [on, delay, shown]);
  const fill = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      onLayout={onLayout}
      className="h-10 basis-[23%] items-center justify-center rounded-full border border-border bg-white"
    >
      <Text className="text-body font-medium">{label}</Text>
      <Animated.View
        pointerEvents="none"
        className="absolute -inset-px items-center justify-center rounded-full bg-ink"
        style={fill}
      >
        <Text className="text-body font-medium text-white">{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

interface Run {
  from: number;
  to: number;
}

// The run after tapping `hour`: started, stretched to it (no longer than LONGEST, from the end
// tapped), shrunk from an end, started again from a middle hour, or cleared.
const tapHour = (run: Run | null, hour: number): Run | null => {
  if (!run) return { from: hour, to: hour };
  if (hour === run.from && hour === run.to) return null;
  if (hour < run.from) return { from: hour, to: Math.min(run.to, hour + LONGEST - 1) };
  if (hour > run.to) return { from: Math.max(run.from, hour - LONGEST + 1), to: hour };
  if (hour === run.from) return { from: hour + 1, to: run.to };
  if (hour === run.to) return { from: run.from, to: hour - 1 };
  return { from: hour, to: hour };
};

export function SearchWhen({
  visible,
  when,
  timezone,
  params,
  onApply,
  onClose,
}: {
  visible: boolean;
  when: When;
  timezone: string;
  // The search as it stands without its when, for counting what a choice would find.
  params: SearchParams;
  onApply: (when: When) => void;
  onClose: () => void;
}) {
  // A draft, applied only with the button.
  const [draft, setDraft] = useState(when);
  useEffect(() => {
    if (visible) setDraft(when);
  }, [visible, when]);

  const today = localDate(timezone);
  const date = draft.date ?? today;
  const days = Array.from({ length: DAYS }, (_, i) => localDate(timezone, i));
  // Today offers only the hours still ahead.
  const nowHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false }).format(
      new Date(),
    ),
  );
  const firstHour = date === today ? Math.min(23, nowHour + 1) : FIRST_HOUR;
  const hours = Array.from({ length: 24 - firstHour }, (_, i) => firstHour + i);

  const run: Run | null = draft.start
    ? {
        from: Number(draft.start.slice(0, 2)),
        to: Number(draft.start.slice(0, 2)) + draft.hours - 1,
      }
    : null;
  // Which hours just joined the run, to fill them in order from the end it grew from.
  const [grewFrom, setGrewFrom] = useState<number | null>(null);
  const pickHour = (hour: number) => {
    const next = tapHour(run, hour);
    setGrewFrom(run && next ? (next.from < run.from ? run.from : run.to) : hour);
    setDraft((previous) => ({
      ...previous,
      start: next ? `${String(next.from).padStart(2, "0")}:00` : null,
      hours: next ? next.to - next.from + 1 : 1,
    }));
  };

  // Dragging across the hours: the run goes from the hour the finger went down on to the one under
  // it now (no longer than LONGEST, the far end following the finger), filling as it passes, with
  // a tick for each new hour. Each pill's frame in the grid is kept to find the hour under a point.
  const frames = useRef(new Map<number, { x: number; y: number; width: number; height: number }>());
  const anchor = useRef<number | null>(null);
  const under = useRef<number | null>(null);
  const downAt = useRef({ x: 0, y: 0 });
  const hourAt = (x: number, y: number) => {
    for (const [hour, frame] of frames.current) {
      // Frames of hours an earlier day showed and this one doesn't are left behind; skip them.
      if (!hours.includes(hour)) continue;
      if (
        x >= frame.x - 4 &&
        x <= frame.x + frame.width + 4 &&
        y >= frame.y - 4 &&
        y <= frame.y + frame.height + 4
      ) {
        return hour;
      }
    }
    return null;
  };
  const dragTo = (hour: number) => {
    const from = anchor.current;
    if (from === null || hour === under.current) return;
    under.current = hour;
    const next =
      hour >= from
        ? { from: Math.max(from, hour - LONGEST + 1), to: hour }
        : { from: hour, to: Math.min(from, hour + LONGEST - 1) };
    setGrewFrom(null);
    setDraft((previous) => ({
      ...previous,
      start: `${String(next.from).padStart(2, "0")}:00`,
      hours: next.to - next.from + 1,
    }));
    void Haptics.selectionAsync();
  };
  const drag = Gesture.Pan()
    .runOnJS(true)
    .minDistance(6)
    .onBegin((event) => {
      downAt.current = { x: event.x, y: event.y };
    })
    .onStart(() => {
      const hour = hourAt(downAt.current.x, downAt.current.y);
      anchor.current = hour;
      under.current = null;
      if (hour !== null) dragTo(hour);
    })
    .onUpdate((event) => {
      const hour = hourAt(event.x, event.y);
      if (hour !== null) dragTo(hour);
    })
    .onFinalize(() => {
      anchor.current = null;
      under.current = null;
    });

  const count = useVenueCount(
    {
      ...params,
      ...(draft.date ? { date: draft.date } : {}),
      ...(draft.start ? { start: draft.start } : {}),
      hours: draft.hours,
    },
    visible,
  );

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text accessibilityRole="header" className="text-[22px] leading-7 font-semibold">
        When do you want to play?
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-5 -mx-6"
        contentContainerClassName="gap-2 px-6"
      >
        {days.map((day) => (
          <DayTile
            key={day}
            date={day}
            timezone={timezone}
            on={day === date}
            onPress={() =>
              setDraft((previous) => ({
                ...previous,
                date: day === today ? null : day,
                // A start that's passed on the new day goes back to any time.
                ...(day === today && previous.start && Number(previous.start.slice(0, 2)) <= nowHour
                  ? { start: null, hours: 1 }
                  : {}),
              }))
            }
          />
        ))}
      </ScrollView>

      <Text className="mt-6 mb-2.5 text-label font-medium text-ink-2">Start</Text>
      {/* Its own gesture root: the sheet is a modal, outside the app's. */}
      <GestureHandlerRootView>
        <GestureDetector gesture={drag}>
          <View className="flex-row flex-wrap gap-2">
            <Pill
              label="Any"
              on={run === null}
              onPress={() => setDraft((previous) => ({ ...previous, start: null, hours: 1 }))}
            />
            {hours.map((hour) => (
              <Pill
                key={hour}
                label={hourLabel(hour)}
                on={run !== null && hour >= run.from && hour <= run.to}
                delay={grewFrom === null ? 0 : Math.abs(hour - grewFrom) * STAGGER}
                onPress={() => pickHour(hour)}
                onLayout={(event) => frames.current.set(hour, event.nativeEvent.layout)}
              />
            ))}
          </View>
        </GestureDetector>
      </GestureHandlerRootView>

      <View className="mt-7 flex-row gap-2.5">
        <View className="w-[104px]">
          <Button
            label="Clear"
            variant="secondary"
            size="small"
            onPress={() => setDraft({ date: null, start: null, hours: 1 })}
          />
        </View>
        <View className="flex-1">
          <Button
            label={
              count === null ? "Show venues" : `Show ${count} ${count === 1 ? "venue" : "venues"}`
            }
            size="small"
            onPress={() => onApply(draft)}
          />
        </View>
      </View>
    </Sheet>
  );
}
