import { useEffect, useMemo, useRef } from "react";
import { FlatList, Pressable, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { addDays, weekOf, weekStartOf } from "@/lib/calendar";
import { intlLocale, isRTL } from "@/lib/language";
import { Text } from "./text";

// The Calendar's week strip and ground chips, shared with the screens that pick a time on it (Move).

// How far the strip reaches either side of this week.
const WEEKS_EACH_WAY = 52;

// S to S, a week to a page, scrolled sideways like any list and settling on a week. The picked day
// sits in an ink disc, today in a grey one when it isn't picked, and a dot marks each day with
// bookings. Settling on another week picks the same weekday there. The list runs left to right
// whatever the language, so its offsets mean the same on iOS and Android; in Arabic the weeks go in
// reversed, and each week's days run right to left.
export function WeekStrip({
  start,
  picked,
  today,
  dots,
  onPick,
  onWeek,
}: {
  start: string;
  picked: string;
  today: string;
  dots: ReadonlySet<string>;
  onPick: (date: string) => void;
  onWeek: (start: string) => void;
}) {
  const { width } = useWindowDimensions();
  const thisWeek = weekStartOf(today);
  const weeks = useMemo(() => {
    const all = Array.from({ length: WEEKS_EACH_WAY * 2 + 1 }, (_, i) =>
      addDays(thisWeek, (i - WEEKS_EACH_WAY) * 7),
    );
    return isRTL ? all.reverse() : all;
  }, [thisWeek]);
  const list = useRef<FlatList<string>>(null);
  const shown = useRef(weeks.indexOf(start));

  // A week picked from outside the strip (a day far off) scrolls it there.
  useEffect(() => {
    const index = weeks.indexOf(start);
    if (index === -1 || index === shown.current) return;
    shown.current = index;
    list.current?.scrollToIndex({ index, animated: true });
  }, [start, weeks]);

  return (
    <FlatList
      ref={list}
      horizontal
      pagingEnabled
      data={weeks}
      keyExtractor={(week) => week}
      getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      initialScrollIndex={Math.max(0, weeks.indexOf(start))}
      initialNumToRender={3}
      windowSize={5}
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={(event) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / width);
        const week = weeks[index];
        shown.current = index;
        if (week && week !== start) onWeek(week);
      }}
      style={{ flexGrow: 0, direction: "ltr" }}
      // A FlatList only redraws its pages when its data changes: these change on their own.
      extraData={[picked, today, dots]}
      renderItem={({ item: week }) => (
        <Week
          start={week}
          width={width}
          picked={picked}
          today={today}
          dots={dots}
          onPick={onPick}
        />
      )}
    />
  );
}

function Week({
  start,
  width,
  picked,
  today,
  dots,
  onPick,
}: {
  start: string;
  width: number;
  picked: string;
  today: string;
  dots: ReadonlySet<string>;
  onPick: (date: string) => void;
}) {
  const letter = new Intl.DateTimeFormat(intlLocale, { timeZone: "UTC", weekday: "narrow" });
  const long = new Intl.DateTimeFormat(intlLocale, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <View className="flex-row px-5" style={{ width, direction: isRTL ? "rtl" : "ltr" }}>
      {weekOf(start).map((date) => {
        const at = new Date(`${date}T12:00:00Z`);
        return (
          <Day
            key={date}
            day={at.getUTCDate()}
            letter={letter.format(at)}
            label={long.format(at)}
            on={date === picked}
            today={date === today}
            dot={dots.has(date)}
            onPress={() => onPick(date)}
          />
        );
      })}
    </View>
  );
}

// One day of the strip. Picking it fades its ink disc and white number in over the plain one (and
// the day before it fades back out), rather than snapping.
function Day({
  day,
  letter,
  label,
  on,
  today,
  dot,
  onPress,
}: {
  day: number;
  letter: string;
  label: string;
  on: boolean;
  today: boolean;
  dot: boolean;
  onPress: () => void;
}) {
  const picked = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    picked.value = withTiming(on ? 1 : 0, { duration: 200 });
  }, [on, picked]);
  const discStyle = useAnimatedStyle(() => ({ opacity: picked.value }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className="flex-1 items-center"
    >
      <Text className="text-[12px] leading-4 text-ink-3">{letter}</Text>
      <View
        className={`mt-1 size-9 items-center justify-center rounded-full ${today ? "bg-chip" : ""}`}
      >
        <Text className="text-[15px] leading-5 text-ink">{day}</Text>
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 items-center justify-center rounded-full bg-ink"
          style={discStyle}
        >
          <Text className="text-[15px] leading-5 font-semibold text-white">{day}</Text>
        </Animated.View>
      </View>
      <View className={`mt-1.5 size-[5px] rounded-full ${dot ? "bg-ink" : ""}`} />
    </Pressable>
  );
}

// A ground filter. Picking it fades its ink fill and white words in over the outlined one, as the
// strip's days do.
export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const picked = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    picked.value = withTiming(on ? 1 : 0, { duration: 200 });
  }, [on, picked]);
  const fillStyle = useAnimatedStyle(() => ({ opacity: picked.value }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className="h-[34px] justify-center rounded-full border border-border px-4"
    >
      <Text className="text-label font-medium text-ink">{label}</Text>
      {/* Over the border too: an absolute child is placed inside it. */}
      <Animated.View
        pointerEvents="none"
        className="absolute items-center justify-center rounded-full bg-ink"
        style={[{ top: -1, bottom: -1, start: -1, end: -1 }, fillStyle]}
      >
        <Text className="text-label font-medium text-white">{label}</Text>
      </Animated.View>
    </Pressable>
  );
}
