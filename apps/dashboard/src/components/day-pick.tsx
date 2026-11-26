import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addDays } from "@/lib/calendar";
import { hourLabel } from "@/lib/when";
import { Text } from "./text";
import { cardShadow } from "./venue-map";
import { Chip, WeekStrip } from "./week-strip";

// What Move and Swap share (Figma D9 605:2, 598:99): picking on the calendar's day with the
// booking lifted off it. The week strip and the grounds (one at a time, from the booking's own;
// user, 2026-11-26: no All grounds), a row's hours as a column, and the lifted booking: a card
// floating low over the list, swaying slowly while it waits, with Cancel.

const NO_DOTS: ReadonlySet<string> = new Set();

export function DayPickHeader({
  weekStart,
  day,
  today,
  onDay,
  grounds,
  groundId,
  onGround,
  dots = NO_DOTS,
}: {
  // Days with something to pick, a dot under each (Swap: bookings to trade with).
  dots?: ReadonlySet<string>;
  weekStart: string;
  day: string;
  today: string;
  onDay: (date: string) => void;
  grounds: readonly { id: string; name: string | null }[];
  groundId: string;
  onGround: (id: string) => void;
}) {
  return (
    <>
      <View style={{ marginHorizontal: -20 }}>
        <WeekStrip
          start={weekStart}
          picked={day}
          today={today}
          dots={dots}
          onPick={onDay}
          // Forward lands on the week's first day, back on its last.
          onWeek={(start) => onDay(start > weekStart ? start : addDays(start, 6))}
        />
      </View>
      {grounds.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -20, marginTop: 8 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {grounds.map((ground) => (
            <Chip
              key={ground.id}
              label={ground.name ?? ""}
              on={groundId === ground.id}
              onPress={() => onGround(ground.id)}
            />
          ))}
        </ScrollView>
      ) : null}
      <View className="mt-4 h-px bg-border" style={{ marginHorizontal: -20 }} />
    </>
  );
}

// A row's hours: when it starts in weight, when it ends in grey under it.
export function HourColumn({
  from,
  to,
  timezone,
  faded = false,
}: {
  from: string;
  to: string;
  timezone: string;
  faded?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View className="w-12">
      <Text className={`text-label font-semibold ${faded ? "text-ink-3" : ""}`}>
        {hourLabel(from, timezone, t)}
      </Text>
      <Text className="text-caption text-ink-3">{hourLabel(to, timezone, t)}</Text>
    </View>
  );
}

// The sway: tilting a little either way as it rises and settles, slowly.
const SWAY_MS = 1600;
const SWAY_LIFT = 4;
// How much higher the tilted card's raised corner (and its shadow) reaches than its straight top,
// and the room left between the last row and it.
const TILT_REACH = 8;
const CARD_GAP = 40;
// FadingScroll's own room at the bottom, under its fade.
const FADE = 28;

// Where the lifted card sits (low, partly over the home indicator's space) and the room the list
// leaves under its last row to scroll clear of it. The screen already ends above that space and
// the scroll keeps its fade's room, so only the rest of the card's reach and a gap are added.
export const useLiftedCard = () => {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom - 12, 8);
  const [height, setHeight] = useState(72);
  return {
    bottom,
    room: Math.max(0, bottom + height + SWAY_LIFT + TILT_REACH + CARD_GAP - insets.bottom - FADE),
    onLayout: (event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height),
  };
};

export function LiftedCard({
  title,
  detail,
  bottom,
  onLayout,
  onCancel,
}: {
  title: string;
  detail: ReactNode;
  bottom: number;
  onLayout: (event: LayoutChangeEvent) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const sway = useSharedValue(0);
  useEffect(() => {
    sway.value = withRepeat(
      withTiming(1, { duration: SWAY_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(sway);
  }, [sway]);
  const swayStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(sway.value, [0, 1], [0, -SWAY_LIFT]) },
      { rotate: `${interpolate(sway.value, [0, 1], [-2, 0.5])}deg` },
    ],
  }));
  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-5"
      style={{ bottom }}
      onLayout={onLayout}
    >
      <Animated.View
        className="flex-row items-center rounded-2xl bg-white px-4 py-3.5"
        style={[cardShadow, swayStyle]}
      >
        <View className="h-9 w-1 rounded-full bg-primary" />
        <View className="ms-4 flex-1">
          <Text className="text-subtitle">{title}</Text>
          <Text className="text-label text-ink-2">{detail}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          hitSlop={8}
          className="ms-3 active:opacity-70"
        >
          <Text className="text-body font-medium underline">{t("screens.move.cancel")}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
