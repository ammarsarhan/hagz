import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, useWindowDimensions, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { useHudAnchor } from "@/components/hud";
import { IconInfoCircle } from "@/components/icons";
import { BackButton } from "@/components/nav";
import { Text } from "@/components/text";
import { PageState } from "@/components/page-state";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { localTimeOf } from "@/lib/ground-filter";
import { intlLocale, isRTL } from "@/lib/language";
import { formatPrice, fromPerHour } from "@/lib/money";
import {
  hourAt,
  kindOf,
  nextDate,
  partOfDay,
  timeOfDay,
  timeRange,
  dayLabel,
  type FreeSlot,
  type PublicGround,
  type PublicVenue,
} from "@/lib/venue";

// See times (Figma C6 round 2, 161:2: "Pick slots"; the user's pick, 2026-11-20): a ground's free
// hours for a day, as chips grouped by part of the day, and the player taps the hours they want,
// one after another: the booking is those hours, no length to choose. Fewer than the ground's
// shortest booking, the hours either side are outlined and Continue waits; at its longest, no more
// can be added. Tapping an hour away from the picked ones starts again from it.
//
// A day runs midnight to midnight (user, 2026-11-22): its own hours, its small hours first as early
// morning. After them, as late night, the next day's first hours, as far as the ground's longest
// booking could run past midnight (or the search's game, if it runs further), so 11 pm and 12 am
// can still be one booking. Only free hours are listed; taken ones will show once there are bookings
// (Phase 4), which is also where Continue goes.

const DAYS = 14;
const PARTS = ["earlyMorning", "morning", "afternoon", "evening", "lateNight"] as const;
// The back button's row and its gap to the title, as on every Screen, and the bar's 8 under it.
const ROW = 40;
const TITLE_GAP = 22;
const BAR_BELOW = 8;
const FADE = 24;
const RISE = 6;

type Loaded<T> =
  { state: "loading" } | { state: "failed"; message: string } | { state: "ready"; data: T };

interface Day {
  date: string;
  days: { first: string; last: string };
  timezone: string;
  currency: string;
  slots: FreeSlot[];
  // The ground's free hours on the next day, of which See times shows the first few as late night.
  night: FreeSlot[];
}

// The day after `date`, as many days as go from `first` up to `last`.
const daysFrom = (first: string, last: string) => {
  const out = [first];
  while (out.length < DAYS && (out.at(-1) ?? first) < last) out.push(nextDate(out.at(-1) ?? first));
  return out;
};

// What a tap on `slot` does to the picked run of hours (in time order, each starting where the last
// ended): next to it, added (up to `longest`); an end, taken off; anywhere else, a fresh start.
const tapped = (picked: FreeSlot[], slot: FreeSlot, longest: number): FreeSlot[] => {
  const first = picked[0];
  const last = picked.at(-1);
  if (!first || !last) return [slot];
  if (picked.some((each) => each.id === slot.id)) {
    // An end comes off; the middle starts again from there.
    if (slot.id === first.id) return picked.slice(1);
    if (slot.id === last.id) return picked.slice(0, -1);
    return [slot];
  }
  const before = slot.endsAt === first.startsAt;
  const after = slot.startsAt === last.endsAt;
  // Next to the pick: added, unless it's already the ground's longest booking (then nothing).
  if (before || after) {
    if (picked.length >= longest) return picked;
    return before ? [slot, ...picked] : [...picked, slot];
  }
  return [slot];
};

export default function Times() {
  // From the venue page, possibly with a search's day, start and length (lib/ground-filter.ts).
  const params = useLocalSearchParams<{
    slug: string;
    ground: string;
    date?: string;
    start?: string;
    hours?: string;
  }>();
  const { slug, ground: groundId } = params;
  const [venue, setVenue] = useState<Loaded<PublicVenue>>({ state: "loading" });
  // The day asked for (none: today), the one on screen, and the days there are: these stay while
  // another day loads, so only the hours change.
  const [date, setDate] = useState<string | undefined>(params.date);
  const [shown, setShown] = useState<string | undefined>(undefined);
  const [days, setDays] = useState<{ first: string; last: string } | null>(null);
  const [day, setDay] = useState<Loaded<Day>>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void send(api.GET("/v1/venues/{slug}", { params: { path: { slug } } })).then((result) => {
      if (!active) return;
      setVenue(
        result.ok
          ? { state: "ready", data: result.data }
          : { state: "failed", message: hudMessage(result.error) },
      );
    });
    return () => {
      active = false;
    };
  }, [slug, attempt]);

  // The day asked for (today to begin with), and the next day's first hours, as late night.
  useEffect(() => {
    let active = true;
    setDay({ state: "loading" });
    void (async () => {
      const read = (on?: string) =>
        send(
          api.GET("/v1/venues/{slug}/availability", {
            params: { path: { slug }, query: on ? { date: on } : {} },
          }),
        );
      const result = await read(date);
      if (!active) return;
      if (!result.ok) {
        setDay({ state: "failed", message: hudMessage(result.error) });
        return;
      }
      setDays(result.data.days);
      setShown(result.data.date);
      const own = result.data.slots.filter((slot) => slot.groundId === groundId);
      const following =
        result.data.date < result.data.days.last ? await read(nextDate(result.data.date)) : null;
      if (!active) return;
      const night =
        following?.ok === true
          ? following.data.slots.filter((slot) => slot.groundId === groundId)
          : [];
      setDay({ state: "ready", data: { ...result.data, slots: own, night } });
    })();
    return () => {
      active = false;
    };
  }, [slug, groundId, date, attempt]);

  const ground =
    venue.state === "ready" ? venue.data.grounds.find((each) => each.id === groundId) : undefined;

  // Only the venue's own failure takes the page; a day that doesn't load says so in its place.
  if (venue.state === "failed" || (venue.state === "ready" && !ground)) {
    return (
      <PageState
        message={venue.state === "failed" ? venue.message : ""}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  }
  if (!ground || venue.state !== "ready") return <PageState loading />;
  return (
    <Picker
      venue={venue.data}
      ground={ground}
      days={days}
      on={date ?? shown}
      day={day.state === "ready" ? day.data : null}
      dayError={day.state === "failed" ? day.message : null}
      asked={
        params.date && params.start
          ? { date: params.date, start: params.start, hours: Number(params.hours ?? 1) }
          : null
      }
      onDate={setDate}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  );
}

function Picker({
  venue,
  ground,
  days,
  on,
  day,
  dayError,
  asked,
  onDate,
  onRetry,
}: {
  venue: PublicVenue;
  ground: PublicGround;
  // The days there are, and the one picked; null and undefined until the first day comes back.
  days: { first: string; last: string } | null;
  on: string | undefined;
  // Null while the day's hours load (or didn't).
  day: Day | null;
  dayError: string | null;
  // The search's game, picked when its day first shows (if it's still free).
  asked: { date: string; start: string; hours: number } | null;
  onDate: (date: string) => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [picked, setPicked] = useState<FreeSlot[]>([]);
  const [footer, setFooter] = useState(0);
  useHudAnchor(footer);

  const longest = ground.maximumSlots;
  // The day's hours, then the next day's first ones (late night): as far past midnight as the
  // ground's longest booking can run from the day's last hour, or as the search's game runs.
  const { slots, nightIds } = useMemo(() => {
    if (!day) return { slots: [], nightIds: new Set<string>() };
    const sample = day.slots[0] ?? day.night[0];
    const slotMinutes = sample
      ? (Date.parse(sample.endsAt) - Date.parse(sample.startsAt)) / 60_000
      : 60;
    const minutesOf = (time: string) => {
      const [hours = 0, minutes = 0] = time.split(":").map(Number);
      return hours * 60 + minutes;
    };
    const askedEnd =
      asked && asked.date === day.date
        ? minutesOf(asked.start) + asked.hours * slotMinutes - 24 * 60
        : 0;
    const reach = Math.max((longest - 1) * slotMinutes, askedEnd);
    const night = day.night.filter(
      (slot) => minutesOf(localTimeOf(slot.startsAt, day.timezone)) < reach,
    );
    return {
      slots: [...day.slots, ...night],
      nightIds: new Set(night.map((slot) => slot.id)),
    };
  }, [day, asked, longest]);

  // A new day starts with nothing picked.
  useEffect(() => setPicked([]), [on]);
  // The search's game, once, when its day's hours are in: the slot at its start and the ones after
  // it, as many as it asked for (up to the ground's longest).
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || !asked || !day || day.date !== asked.date) return;
    applied.current = true;
    const own = slots;
    const first = own.find((slot) => localTimeOf(slot.startsAt, day.timezone) === asked.start);
    if (!first) return;
    const run = [first];
    while (run.length < Math.min(asked.hours, ground.maximumSlots)) {
      const following = own.find((slot) => slot.startsAt === run.at(-1)?.endsAt);
      if (!following) break;
      run.push(following);
    }
    setPicked(run);
  }, [asked, day, slots, ground.maximumSlots]);

  const shortest = ground.minimumSlots;
  const name = ground.name ?? kindOf(ground);
  const timezone = day?.timezone ?? venue.marketplace.timezone;
  const currency = day?.currency ?? venue.marketplace.currency;
  const pickedIds = new Set(picked.map((slot) => slot.id));
  const first = picked[0];
  const last = picked.at(-1);
  const ready = picked.length >= shortest;
  // Short of the shortest booking: the free hours either side, outlined.
  const next = new Set(
    !first || !last || ready
      ? []
      : slots
          .filter((slot) => slot.endsAt === first.startsAt || slot.startsAt === last.endsAt)
          .map((slot) => slot.id),
  );
  const range = first && last ? timeRange(first.startsAt, last.endsAt, timezone) : "";
  const total = picked.reduce((sum, slot) => sum + slot.price, 0);

  const groups = useMemo(
    () =>
      PARTS.map((part) => ({
        part,
        slots: slots.filter(
          (slot) =>
            (nightIds.has(slot.id) ? "lateNight" : partOfDay(hourAt(slot.startsAt, timezone))) ===
            part,
        ),
      })).filter((group) => group.slots.length > 0),
    [slots, nightIds, timezone],
  );

  const cheapest = ground.priceFrom;
  const books =
    shortest === longest
      ? t("screens.times.booksExactly", { count: shortest })
      : t("screens.times.booksRange", { min: shortest, max: longest });

  // The note under the hours: how to start, what's missing, or what's picked.
  const note = !first
    ? { strong: "", text: t("screens.times.start") }
    : !ready
      ? {
          strong: t("screens.times.short", { ground: name, count: shortest }),
          text: t("screens.times.addNext"),
        }
      : {
          strong: t("screens.times.picked", {
            hours: t("formats.hours", { count: picked.length }),
            range,
          }),
          text:
            picked.length >= longest
              ? t("screens.times.longest", { ground: name })
              : t("screens.times.longer"),
        };

  // The page scrolls under a fixed bar, the title coming back small beside the back button.
  const bar = insets.top + ROW + BAR_BELOW;
  const scrollY = useSharedValue(0);
  const titleEnd = useSharedValue(Number.POSITIVE_INFINITY);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const compact = useAnimatedStyle(() => {
    const gone = titleEnd.value - bar;
    const progress = interpolate(scrollY.value, [gone - FADE, gone], [0, 1], "clamp");
    return { opacity: progress, transform: [{ translateY: (1 - progress) * RISE }] };
  });
  const hairline = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 12], [0, 1], "clamp"),
  }));

  return (
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <StatusBar style="dark" />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + ROW + TITLE_GAP,
          paddingHorizontal: 24,
          paddingBottom: footer + 32,
        }}
      >
        <Title
          subtitle={`${kindOf(ground)} · ${books}`}
          tight
          onTitleLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            titleEnd.value = y + height;
          }}
        >
          {name}
        </Title>

        {days && on ? (
          <DayTiles
            days={daysFrom(days.first, days.last)}
            today={days.first}
            on={on}
            onPick={onDate}
          />
        ) : (
          <TilesSkeleton />
        )}

        <View className="mt-7 mb-3.5 flex-row items-center justify-between">
          <Text accessibilityRole="header" className="text-[18px] leading-6 font-semibold">
            {t("screens.times.heading")}
          </Text>
          {on ? <Text className="text-label text-ink-2">{dayLabel(on)}</Text> : null}
        </View>

        {dayError && !day ? (
          <View className="items-start gap-4 py-6">
            <Text className="text-subtitle text-ink-2">{dayError}</Text>
            <Button label={t("common.actions.tryAgain")} size="small" onPress={onRetry} />
          </View>
        ) : !day ? (
          <HoursSkeleton />
        ) : groups.length === 0 ? (
          <View className="gap-1 py-6">
            <Text className="text-subtitle font-medium">{t("screens.times.none")}</Text>
            <Text className="text-subtitle text-ink-2">{t("screens.times.noneHint")}</Text>
          </View>
        ) : (
          <Animated.View key={day.date} entering={FadeIn.duration(220)}>
            <View className="gap-4">
              {groups.map(({ part, slots }) => (
                <View key={part} className="gap-2">
                  <Text className="text-label text-unit">{t(`screens.times.parts.${part}`)}</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {slots.map((slot) => (
                      <Slot
                        key={slot.id}
                        time={timeOfDay(slot.startsAt, timezone)}
                        price={formatPrice(slot.price, currency)}
                        state={pickedIds.has(slot.id) ? "on" : next.has(slot.id) ? "next" : "free"}
                        onPress={() => setPicked((now) => tapped(now, slot, longest))}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
            <View className="mt-5 flex-row items-start gap-2">
              <IconInfoCircle size={18} color={colors.ink2} strokeWidth={1.75} />
              <Text className="flex-1 text-label text-ink-2">
                {note.strong ? (
                  <Text className="font-medium text-ink">{`${note.strong} `}</Text>
                ) : null}
                {note.text}
              </Text>
            </View>
          </Animated.View>
        )}
      </Animated.ScrollView>

      {/* The fixed bar: the back button, and the ground's name once the big one is under it. */}
      <View
        className="absolute top-0 right-0 left-0 bg-white px-5"
        style={{ height: bar, paddingTop: insets.top }}
      >
        <View className="-mx-1 h-10 flex-row items-center gap-3">
          <BackButton onPress={() => router.back()} />
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[compact, { maxWidth: width - 40 - 40 - 12 }]}
          >
            <Text className="text-body leading-[1.25] font-semibold" numberOfLines={1}>
              {name}
            </Text>
          </Animated.View>
        </View>
        <Animated.View
          className="absolute right-0 bottom-0 left-0 h-px bg-hairline"
          style={hairline}
        />
      </View>

      {/* What's picked and what it comes to, and Continue (lime once there's enough). */}
      <View
        className="absolute right-0 bottom-0 left-0 flex-row items-center justify-between gap-6 border-t border-border bg-white px-6 pt-3.5"
        style={{ paddingBottom: insets.bottom + 8 }}
        onLayout={(event) => setFooter(event.nativeEvent.layout.height)}
      >
        <View className="shrink gap-0.5">
          <Text className="text-button font-medium">
            {first
              ? formatPrice(total, currency)
              : cheapest === null
                ? " "
                : fromPerHour(cheapest, currency)}
          </Text>
          <Text className="text-caption text-unit" numberOfLines={1}>
            {first && day
              ? t("screens.times.line", { day: dayLabel(day.date), range })
              : t("screens.times.pick", { count: shortest })}
          </Text>
        </View>
        <View className="w-[150px]">
          <Button
            label={t("screens.times.continue")}
            variant={ready ? "moment" : "secondary"}
            size="small"
            disabled={!ready}
            onPress={() => {
              // Anything else? next: extras and Need players?, at every venue.
              if (!first || !last || !day) return;
              router.push({
                pathname: "/venue/[slug]/extras",
                params: {
                  slug: venue.slug,
                  ground: ground.id,
                  date: day.date,
                  startsAt: first.startsAt,
                  endsAt: last.endsAt,
                  slots: String(picked.length),
                  price: String(total),
                },
              });
            }}
          />
        </View>
      </View>
    </View>
  );
}

// Today and the days after it, as tiles: the weekday (or Today) over the date. The picked day's
// black fades in as the last one's fades out (Search's chips do the same).
function DayTiles({
  days,
  today,
  on,
  onPick,
}: {
  days: string[];
  today: string;
  on: string;
  onPick: (date: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -24 }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 24 }}
    >
      {days.map((date) => (
        <DayTile
          key={date}
          date={date}
          today={date === today}
          picked={date === on}
          onPress={() => onPick(date)}
        />
      ))}
    </ScrollView>
  );
}

const TILE = "h-[72px] w-[58px] items-center justify-center gap-0.5 rounded-[14px]";

function DayTile({
  date,
  today,
  picked,
  onPress,
}: {
  date: string;
  today: boolean;
  picked: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const shown = useSharedValue(picked ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(picked ? 1 : 0, { duration: 180 });
  }, [picked, shown]);
  const fill = useAnimatedStyle(() => ({ opacity: shown.value }));
  const at = new Date(`${date}T12:00:00Z`);
  const weekday = today
    ? t("formats.today")
    : new Intl.DateTimeFormat(intlLocale, { timeZone: "UTC", weekday: "short" }).format(at);
  const words = (white: boolean) => (
    <>
      <Text className={`text-caption ${white ? "text-white" : "text-ink-2"}`}>{weekday}</Text>
      <Text className={`text-[20px] leading-6 font-medium ${white ? "text-white" : "text-ink"}`}>
        {at.getUTCDate()}
      </Text>
    </>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: picked }}
      onPress={onPress}
      className={`${TILE} border border-border bg-white`}
    >
      {words(false)}
      <Animated.View
        pointerEvents="none"
        className={`absolute -inset-px ${TILE} bg-ink`}
        style={fill}
      >
        {words(true)}
      </Animated.View>
    </Pressable>
  );
}

// A grey stand-in, gently pulsing, in a real piece's exact size, so nothing moves when it arrives.
function Bone({ className }: { className: string }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View className={`bg-chip ${className}`} style={style} />;
}

// The day tiles before the first day comes back.
function TilesSkeleton() {
  return (
    <View className="-mx-6 flex-row gap-2 overflow-hidden px-6">
      {Array.from({ length: 6 }, (_, i) => (
        <Bone key={i} className="h-[72px] w-[58px] rounded-[14px]" />
      ))}
    </View>
  );
}

// A day's hours on their way: two groups of chips and the note's line, in their real sizes.
function HoursSkeleton() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="gap-4"
    >
      {[2, 6].map((count, group) => (
        <View key={group} className="gap-2">
          <Bone className="h-[14px] w-16 rounded-full" />
          <View className="flex-row flex-wrap gap-2">
            {Array.from({ length: count }, (_, i) => (
              <Bone key={i} className="h-[54px] w-[76px] rounded-[14px]" />
            ))}
          </View>
        </View>
      ))}
      <Bone className="mt-1 h-[14px] w-56 rounded-full" />
    </View>
  );
}

// An hour: its start and price. Picked, its black (with white words) fades in over the white one,
// like the day tiles; next to a pick that's still short, a dashed outline.
function Slot({
  time,
  price,
  state,
  onPress,
}: {
  time: string;
  price: string;
  state: "free" | "on" | "next";
  onPress: () => void;
}) {
  const on = state === "on";
  const shown = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(on ? 1 : 0, { duration: 160 });
  }, [on, shown]);
  const fill = useAnimatedStyle(() => ({ opacity: shown.value }));
  const edge: ViewStyle =
    state === "next"
      ? { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.ink }
      : { borderWidth: 1, borderColor: "#ebebeb" };
  const words = (white: boolean) => (
    <>
      <Text className={`text-subtitle font-medium ${white ? "text-white" : ""}`}>{time}</Text>
      <Text className={`text-[12px] leading-4 ${white ? "text-white" : "text-unit"}`}>{price}</Text>
    </>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${time}, ${price}`}
      onPress={onPress}
      className="h-[54px] w-[76px] items-center justify-center gap-px rounded-[14px] bg-white"
      style={edge}
    >
      {words(false)}
      <Animated.View
        pointerEvents="none"
        className="absolute -inset-[1.5px] items-center justify-center gap-px rounded-[14px] bg-ink"
        style={fill}
      >
        {words(true)}
      </Animated.View>
    </Pressable>
  );
}
