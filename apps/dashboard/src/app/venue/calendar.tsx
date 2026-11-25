import { useQueries, useQuery, type QueryFilters } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { FlatList, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  Keyframe,
  LayoutAnimationConfig,
  LinearTransition,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isProblem } from "@hagz/api";
import { Bone } from "@/components/bone";
import { Button } from "@/components/button";
import { useHud, useHudAnchor } from "@/components/hud";
import { OfflineArt } from "@/components/offline-art";
import { QuietDayArt } from "@/components/quiet-day-art";
import { IconArrowUp, IconInbox, IconPlus } from "@/components/icons";
import { usePullToRefresh } from "@/components/pull-to-refresh";
import { useTabBarHeight } from "@/components/tab-bar";
import { Text } from "@/components/text";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import {
  addDays,
  bookingDays,
  dayRows,
  hourGroups,
  localDateOf,
  weekdayOf,
  weekOf,
  weekStartOf,
  type CalendarRow,
  type StaffBooking,
} from "@/lib/calendar";
import { bookingRequests } from "@/lib/booking-requests";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { intlLocale, isRTL } from "@/lib/language";
import { decimalsOf, formatAmount } from "@/lib/money";
import { useRefreshWhenShown } from "@/lib/use-refresh";
import { useNow } from "@/lib/use-now";
import { dayLabel, hourLabel, sentenceTime } from "@/lib/when";

// The Calendar tab (Figma D6 round 2, "B · The day as a list"), titled with the picked day, which shrinks into the header as the strip docks: a week
// strip with the picked day in an ink disc and a dot under each day with bookings, the grounds as chips, and
// the day's bookings and closed times as rows in time order, with a grey line where now is.
// Requests live behind the inbox button, its red count hidden at none.
//
// The week's bookings and slots are read at once, so moving between its days doesn't wait. What
// players do in the app (book, cancel, pay) changes them from elsewhere, so they're read again when
// the tab comes back into view and every minute while it's open.

const REFRESH_EVERY = 60_000;
// A day's rows come in one after another when it or a ground is picked, each a beat behind the one above; past
// the first dozen (well below the fold) they all come in together.
const staggered = (index: number) =>
  FadeInDown.delay(Math.min(index, 12) * 35)
    .duration(260)
    .withInitialValues({ transform: [{ translateY: 12 }] });

// The + coming back when a day gone by gives way to today or one to come: it fades in growing to
// its size, and the inbox button beside it slides over to make room. Not on first showing the tab.
const PLUS_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.6 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(220);
const MAKE_ROOM = LinearTransition.duration(220);

// The floating + button, and its gap above the tab bar.
const FAB = 56;
const FAB_GAP = 16;
// From the status bar to the title row (the customer app's tabs put their title 16 below it; the
// row is 40 for the round buttons), the gap to the strip, and the strip's height: weekday letter,
// day disc and dot.
const TOP = 13;
const TITLE_TO_STRIP = 15;
// The strip without its dots (weekday letter and day disc), and the room the dots' row adds under
// it, with a little gap, while the week on show has any. It opens and closes as weeks change.
const STRIP = 16 + 4 + 36;
const DOT_ROOM = 6 + 5 + 4;
// The title is 24 in the page and shrinks to 17 docked over the strip (user: 28 to 15 was too
// abrupt), with this much room above the strip.
const DOCKED_SCALE = 17 / 24;
const DOCKED_TITLE = 30;
// The venue's timezone until the first answer says it; venues are in Egypt for now.
const FALLBACK_TIMEZONE = "Africa/Cairo";

const fetched = async <T,>(request: Promise<{ data?: T; error?: unknown }>): Promise<T> => {
  const result = await send(request);
  if (!result.ok) throw result.error;
  return result.data;
};

const calendarKey = (venueId: string, ...rest: string[]) => ["staff", "venues", venueId, ...rest];

// While another week loads, the one before stays on screen; never another venue's, after a switch.
const sameVenue =
  (venueId: string) =>
  <T,>(previous: T | undefined, query: { queryKey: readonly unknown[] } | undefined) =>
    query?.queryKey[2] === venueId ? previous : undefined;

// A week's bookings (the days that hold slots), from its Sunday.
const weekBookings = (venueId: string, start: string, enabled: boolean) => ({
  queryKey: calendarKey(venueId, "bookings", start),
  queryFn: async () =>
    (
      await fetched(
        api.GET("/v1/staff/venues/{venueId}/bookings", {
          params: { path: { venueId }, query: { date: start, span: 7 } },
        }),
      )
    ).data,
  enabled,
  refetchInterval: REFRESH_EVERY,
});

// The weeks either side as one list. Defined once, so useQueries keeps its answer between renders
// until a week's data changes.
const bothWeeks = (results: { data?: StaffBooking[] }[]) =>
  results.flatMap((result) => result.data ?? []);

// Every read of this tab, for any venue and week.
const REFRESHED: QueryFilters[] = [
  {
    predicate: ({ queryKey }) =>
      queryKey[0] === "staff" &&
      queryKey[1] === "venues" &&
      (queryKey[3] === "bookings" || queryKey[3] === "slots"),
  },
];

export default function VenueCalendar() {
  const { t } = useTranslation();
  const hud = useHud();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const canSeeBookings = venue !== undefined && venue.permissions.bookings !== "none";
  const canSeeSchedule = venue !== undefined && venue.permissions.schedule !== "none";
  useRefreshWhenShown(REFRESHED);

  // The minute, for the now line and for rows ending.
  const now = useNow((at) => Math.floor(at / 60_000) * 60_000 + 60_000);
  const [timezone, setTimezone] = useState(FALLBACK_TIMEZONE);
  const today = localDateOf(now, timezone);
  // Null until a day is tapped: today, whichever day that is.
  const [picked, setPicked] = useState<string | null>(null);
  const day = picked ?? today;
  const [groundId, setGroundId] = useState<string | null>(null);
  const weekStart = weekStartOf(day);

  const bookings = useQuery({
    ...weekBookings(venueId, weekStart, canSeeBookings),
    placeholderData: sameVenue(venueId),
  });
  // The weeks either side too, so a swipe lands on their dots already there.
  const around = useQueries({
    queries: [-7, 7].map((days) => weekBookings(venueId, addDays(weekStart, days), canSeeBookings)),
    combine: bothWeeks,
  });
  const slots = useQuery({
    queryKey: calendarKey(venueId, "slots", weekStart),
    queryFn: () =>
      fetched(
        api.GET("/v1/staff/venues/{venueId}/slots", {
          params: { path: { venueId }, query: { date: weekStart, span: 7 } },
        }),
      ),
    enabled: canSeeSchedule,
    refetchInterval: REFRESH_EVERY,
    placeholderData: sameVenue(venueId),
  });
  const pending = useQuery(bookingRequests(venueId, canSeeBookings));

  const answeredZone = slots.data?.timezone ?? bookings.data?.[0]?.timezone;
  useEffect(() => {
    if (answeredZone) setTimezone(answeredZone);
  }, [answeredZone]);

  // The day can't be shown without its bookings and slots: the Unplugged scene and Try again take
  // its place. Anything else that fails (a refresh with the day already on screen, the requests)
  // says so in the HUD.
  const dayFailure =
    (bookings.isError && bookings.data === undefined && bookings.error) ||
    (slots.isError && slots.data === undefined && slots.error) ||
    undefined;
  const failure = [bookings, slots, pending].find((read) => read.isError)?.error;
  useEffect(() => {
    if (failure && !dayFailure) hud.show(hudMessage(failure));
  }, [failure, dayFailure, hud]);
  const retry = () => {
    for (const read of [bookings, slots, pending]) if (read.isError) void read.refetch();
  };

  // The grounds in the venue's order: the slots know them all; without the schedule, the ones that
  // have bookings this week.
  const grounds = useMemo(() => {
    if (slots.data) return slots.data.grounds.map(({ id, name }) => ({ id, name }));
    const seen = new Map<string, string | null>();
    for (const booking of bookings.data ?? []) seen.set(booking.ground.id, booking.ground.name);
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [slots.data, bookings.data]);

  const rows = useMemo(
    () =>
      dayRows({
        date: day,
        timezone,
        bookings: bookings.data ?? [],
        slots: slots.data?.slots ?? [],
        groundOrder: grounds.map((ground) => ground.id),
        groundId,
        now,
      }),
    [day, timezone, bookings.data, slots.data, grounds, groundId, now],
  );
  const dots = useMemo(
    () => bookingDays([...(bookings.data ?? []), ...around, ...(pending.data ?? [])], timezone),
    [bookings.data, around, pending.data, timezone],
  );
  const requests = pending.data?.length ?? 0;
  const groundName = (id: string) => grounds.find((ground) => ground.id === id)?.name ?? "";

  // Until this week's bookings and its free hours are both in. A read still showing the week before
  // (placeholderData, while the new one loads) counts as not in: the day shows once, whole, rather
  // than its bookings first and its free hours a moment later (user).
  const waiting = (read: { data?: unknown; isError: boolean; isPlaceholderData: boolean }) =>
    (read.data === undefined || read.isPlaceholderData) && !read.isError;
  const loading = (canSeeBookings && waiting(bookings)) || (canSeeSchedule && waiting(slots));
  // It scrolls the way the customer app's Bookings and Search do: the title at the top of the page,
  // the week strip riding up with it until it docks under the status bar, a white header fading in
  // behind it, and pull to refresh holding a small spinner at the top.
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarHeight();
  const top = insets.top + TOP;
  const dockAt = insets.top + 6;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  // The strip docks under the title, which docks above it: the day, 28 pt in its place in the page,
  // rides up and shrinks to 15 pt as the page scrolls, reaching the header as the strip does.
  const stripDock = dockAt + DOCKED_TITLE;
  // The title's 30 pt line, centred in the 40 pt row beside the round buttons.
  const titleStart = top + 5;
  const stripStart = useSharedValue(top + 40 + TITLE_TO_STRIP);
  const weekHasDots = weekOf(weekStart).some((date) => dots.has(date));
  const dotRoom = useSharedValue(weekHasDots ? DOT_ROOM : 0);
  useEffect(() => {
    dotRoom.value = withTiming(weekHasDots ? DOT_ROOM : 0, { duration: 220 });
  }, [weekHasDots, dotRoom]);
  const slotStyle = useAnimatedStyle(() => ({ height: STRIP + dotRoom.value }));
  const headerHeight = useAnimatedStyle(() => ({ height: stripDock + STRIP + dotRoom.value + 10 }));
  const stripStyle = useAnimatedStyle(() => ({
    // Cut to the room it has, so a hidden dots' row doesn't cover the chips under it.
    height: STRIP + dotRoom.value,
    transform: [{ translateY: Math.max(stripDock, stripStart.value - scrollY.value) }],
  }));
  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      stripStart.value - scrollY.value,
      [stripDock + 24, stripDock],
      [0, 1],
      "clamp",
    ),
  }));
  const titleStyle = useAnimatedStyle(() => {
    // Pulled down past the top, it follows the page down.
    if (scrollY.value < 0) return { transform: [{ translateY: titleStart - scrollY.value }] };
    const docking = interpolate(
      scrollY.value,
      [0, Math.max(1, stripStart.value - stripDock)],
      [0, 1],
      "clamp",
    );
    return {
      transform: [
        { translateY: interpolate(docking, [0, 1], [titleStart, dockAt]) },
        { scale: interpolate(docking, [0, 1], [1, DOCKED_SCALE]) },
      ],
    };
  });

  // Once the title's + has scrolled away, a blue one floats in the bottom corner, fading in as the
  // strip docks and out as it leaves. The HUD sits above it while it shows.
  const [floating, setFloating] = useState(false);
  const fab = useSharedValue(0);
  useAnimatedReaction(
    () => stripStart.value - scrollY.value <= stripDock,
    (docked, before) => {
      if (docked === before) return;
      fab.value = withTiming(docked ? 1 : 0, { duration: 180 });
      runOnJS(setFloating)(docked);
    },
  );
  const fabStyle = useAnimatedStyle(() => ({
    opacity: fab.value,
    transform: [{ scale: interpolate(fab.value, [0, 1], [0.85, 1]) }],
  }));
  // Nothing can be added to a day gone by: no + by the title or floating on one (user).
  const pastDay = day < today;
  useHudAnchor(tabBar + (floating && !pastDay ? FAB + FAB_GAP : 0));

  // Today, once the hour we're in (its time in baby blue) has gone up under the header, a black
  // "↑ Now" pill comes in by the + and scrolls back to it. Where it sits: the rows' place in the page
  // and its place in them.
  const page = useAnimatedRef<Animated.ScrollView>();
  const listY = useSharedValue(0);
  const nowY = useSharedValue(-1);
  const [pastNow, setPastNow] = useState(false);
  const nowPill = useSharedValue(0);
  useAnimatedReaction(
    () =>
      nowY.value >= 0 &&
      listY.value + nowY.value - scrollY.value < stripDock + STRIP + dotRoom.value + 10,
    (past, before) => {
      if (past === before) return;
      nowPill.value = withTiming(past ? 1 : 0, { duration: 180 });
      runOnJS(setPastNow)(past);
    },
  );
  const nowPillStyle = useAnimatedStyle(() => ({
    opacity: nowPill.value,
    transform: [{ translateY: interpolate(nowPill.value, [0, 1], [8, 0]) }],
  }));
  const backToNow = () =>
    page.current?.scrollTo({
      // The hour a little under the docked header.
      y: Math.max(0, listY.value + nowY.value - (stripDock + STRIP + dotRoom.value + 10) - 96),
      animated: true,
    });

  const [refreshing, setRefreshing] = useState(false);
  const pull = usePullToRefresh({
    scrollY,
    busy: refreshing,
    onRefresh: () => {
      setRefreshing(true);
      void Promise.all([bookings.refetch(), slots.refetch(), pending.refetch()]).finally(() =>
        setRefreshing(false),
      );
    },
  });

  const comingNext = () => hud.show(t("common.comingNext"));
  // A booking opens its page; free and closed times wait for their own screens.
  const openRow = (row: CalendarRow) => {
    if (row.kind === "free" || row.kind === "closed") comingNext();
    else router.push(`/booking/${row.booking.id}`);
  };
  // What's on show: a new day or ground remounts the rows, so they come in one after another again.
  const shown = `${day}:${groundId ?? "all"}`;
  const showNow = day === today;
  useEffect(() => {
    if (!showNow || loading || dayFailure) nowY.value = -1;
  }, [showNow, loading, dayFailure, nowY]);
  const groups = useMemo(() => hourGroups(rows, timezone), [rows, timezone]);
  // The time we're at, in baby blue: on All grounds the hour's heading, on a ground the first row
  // under way.
  const nowGroup = showNow
    ? groups.findIndex((group) => group.hour <= now && now < group.hour + HOUR)
    : -1;
  const nowRow = showNow
    ? rows.findIndex((row) => Date.parse(row.startsAt) <= now && now < Date.parse(row.endsAt))
    : -1;
  const placedNow = (y: number) => {
    nowY.value = y;
  };
  useEffect(() => {
    if ((groundId === null ? nowGroup : nowRow) === -1) nowY.value = -1;
  }, [groundId, nowGroup, nowRow, nowY]);
  // A day gone by with nothing booked (on the ground picked) shows the Quiet day scene instead of
  // its spent free hours. Without bookings access there's no telling.
  const quietDay =
    canSeeBookings && pastDay && rows.every((row) => row.kind === "free" || row.kind === "closed");
  const groundsOf = (row: CalendarRow) =>
    row.kind === "free" ? row.groundIds.map(groundName).join(", ") : groundName(row.groundId);

  return (
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <StatusBar style="dark" />
      <Animated.ScrollView
        ref={page}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        refreshControl={pull.control}
        contentContainerStyle={{ paddingTop: top, paddingHorizontal: 20, paddingBottom: 24 }}
      >
        <View className="flex-row items-center">
          {/* The title's place: the day floats over it (below), so it can dock. */}
          <View className="flex-1" />
          <Animated.View layout={MAKE_ROOM}>
            <RoundButton
              label={
                requests > 0
                  ? t("screens.calendar.requestsWaiting", { count: requests })
                  : t("screens.calendar.requests")
              }
              onPress={() => router.push("/requests")}
              badge={requests}
            >
              <IconInbox size={20} color={colors.ink} strokeWidth={1.75} />
            </RoundButton>
          </Animated.View>
          <LayoutAnimationConfig skipEntering>
            {pastDay ? null : (
              <Animated.View entering={PLUS_IN} className="ms-2">
                <RoundButton label={t("screens.calendar.add")} onPress={comingNext}>
                  <IconPlus size={20} color={colors.ink} strokeWidth={1.75} />
                </RoundButton>
              </Animated.View>
            )}
          </LayoutAnimationConfig>
        </View>

        {/* The strip's slot: the strip floats over it (below), so it can dock. */}
        <Animated.View
          style={[{ marginTop: TITLE_TO_STRIP }, slotStyle]}
          onLayout={(event) => {
            // Measured in the page, whose top padding it already includes.
            stripStart.value = event.nativeEvent.layout.y;
          }}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -20, marginTop: 10 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          <Chip
            label={t("screens.calendar.allGrounds")}
            on={groundId === null}
            onPress={() => setGroundId(null)}
          />
          {grounds.map((ground) => (
            <Chip
              key={ground.id}
              label={ground.name ?? ""}
              on={groundId === ground.id}
              onPress={() => setGroundId(ground.id)}
            />
          ))}
        </ScrollView>

        <View className="mt-4 h-px bg-border" style={{ marginHorizontal: -20 }} />

        <View
          className="gap-4 pt-5"
          onLayout={(event) => {
            listY.value = event.nativeEvent.layout.y;
          }}
        >
          {dayFailure ? (
            <View className="items-center pt-6">
              <OfflineArt scale={0.8} />
              <Text
                accessibilityRole="header"
                className="mt-3 mb-2 text-center text-heading font-semibold"
              >
                {isProblem(dayFailure)
                  ? t("screens.calendar.failedTitle")
                  : t("screens.calendar.offlineTitle")}
              </Text>
              <Text className="text-center text-body text-ink-2">
                {isProblem(dayFailure) ? hudMessage(dayFailure) : t("screens.calendar.offlineBody")}
              </Text>
              <View className="mt-6 self-stretch">
                <Button
                  label={t("screens.calendar.tryAgain")}
                  variant="secondary"
                  onPress={retry}
                />
              </View>
            </View>
          ) : loading ? (
            Array.from({ length: 8 }, (_, index) => <RowBone key={index} />)
          ) : quietDay ? (
            <Animated.View
              key={`${shown}:quiet`}
              entering={staggered(0)}
              className="items-center pt-6"
            >
              <QuietDayArt scale={0.8} />
              <Text
                accessibilityRole="header"
                className="mt-3 mb-2 text-center text-heading font-semibold"
              >
                {t("screens.calendar.quietTitle")}
              </Text>
              <Text className="text-center text-body text-ink-2">
                {t("screens.calendar.quietBody", { day: dayLabel(day, t) })}
              </Text>
            </Animated.View>
          ) : groundId === null ? (
            // All grounds: under hour headings.
            groups.map((group, index) => (
              <Animated.View
                key={`${shown}:${group.hour}`}
                entering={staggered(index)}
                className="gap-2"
                onLayout={
                  index === nowGroup ? (event) => placedNow(event.nativeEvent.layout.y) : undefined
                }
              >
                {/* Pulled out by its padding, so the words line up with the rows either way. */}
                <View
                  className={`-mx-2 self-start rounded-lg px-2 py-0.5 ${index === nowGroup ? NOW_TINT : ""}`}
                >
                  <Text
                    className={`leading-5 font-semibold ${index === nowGroup ? `text-label ${NOW_TEXT}` : `text-body ${group.rows.every(isOver) ? "text-ink-3" : ""}`}`}
                  >
                    {hourLabel(new Date(group.hour).toISOString(), timezone, t)}
                  </Text>
                </View>
                {/* Back to back, 2 pt apart: each row's bar an equal piece of one bar for the hour. */}
                <View className="gap-0.5">
                  {group.rows.map((row) => (
                    <Row
                      key={row.key}
                      row={row}
                      hour={group.hour}
                      timezone={timezone}
                      ground={groundsOf(row)}
                      currency={slots.data?.currency ?? "EGP"}
                      onPress={() => openRow(row)}
                    />
                  ))}
                </View>
              </Animated.View>
            ))
          ) : (
            rows.map((row, index) => (
              <Animated.View
                key={`${shown}:${row.key}`}
                entering={staggered(index)}
                onLayout={
                  index === nowRow ? (event) => placedNow(event.nativeEvent.layout.y) : undefined
                }
              >
                <Row
                  row={row}
                  timezone={timezone}
                  ground={groundsOf(row)}
                  currency={slots.data?.currency ?? "EGP"}
                  current={index === nowRow}
                  onPress={() => openRow(row)}
                />
              </Animated.View>
            ))
          )}
        </View>
      </Animated.ScrollView>

      {pull.spinner}

      {/* Level with the +: centred on its 56 pt. */}
      <Animated.View
        pointerEvents={pastNow ? "box-none" : "none"}
        className="absolute right-0 left-0 items-center"
        style={[{ bottom: FAB_GAP + (FAB - 40) / 2 }, nowPillStyle]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("screens.calendar.backToNow")}
          onPress={backToNow}
          className="h-10 flex-row items-center gap-1.5 rounded-full bg-ink px-4 active:opacity-80"
        >
          <IconArrowUp size={16} color={colors.white} strokeWidth={2} />
          <Text className="text-label font-medium text-white">
            {t("screens.calendar.backToNow")}
          </Text>
        </Pressable>
      </Animated.View>

      <LayoutAnimationConfig skipEntering>
        {pastDay ? null : (
          <Animated.View
            pointerEvents={floating ? "auto" : "none"}
            className="absolute"
            style={[{ end: 20, bottom: FAB_GAP }, fabStyle]}
          >
            <Animated.View entering={PLUS_IN}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("screens.calendar.add")}
                onPress={comingNext}
                className="items-center justify-center rounded-full bg-primary active:opacity-80"
                style={{
                  width: FAB,
                  height: FAB,
                  shadowColor: colors.ink,
                  shadowOpacity: 0.18,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 6,
                }}
              >
                <IconPlus size={26} color={colors.onPrimary} strokeWidth={2} />
              </Pressable>
            </Animated.View>
          </Animated.View>
        )}
      </LayoutAnimationConfig>

      {/* The header the strip docks in: white, fading in as it arrives. */}
      <Animated.View
        pointerEvents="none"
        className="absolute top-0 right-0 left-0 border-b border-hairline bg-white"
        style={[headerHeight, headerStyle]}
      />
      <Animated.View
        pointerEvents="none"
        className="absolute top-0"
        style={[{ start: 20, transformOrigin: isRTL ? "right top" : "left top" }, titleStyle]}
      >
        <Text accessibilityRole="header" className="text-heading font-semibold tracking-[-0.3px]">
          {dayLabel(day, t)}
        </Text>
      </Animated.View>
      <Animated.View className="absolute top-0 right-0 left-0 overflow-hidden" style={stripStyle}>
        <WeekStrip
          start={weekStart}
          picked={day}
          today={today}
          dots={dots}
          onPick={setPicked}
          onWeek={(start) => setPicked(addDays(start, weekdayOf(day)))}
        />
      </Animated.View>
    </View>
  );
}

// A round grey 40 pt button by the title, with an optional red count on its corner (none at 0).
function RoundButton({
  label,
  onPress,
  badge = 0,
  children,
}: {
  label: string;
  onPress: () => void;
  badge?: number;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      className="size-10 items-center justify-center rounded-full bg-chip active:opacity-70"
    >
      {children}
      {badge > 0 ? (
        <View
          className="absolute h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red px-1"
          style={{ top: -5, end: -6 }}
        >
          <Text className="text-[11px] leading-[14px] font-semibold text-white">
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// How far the strip reaches either side of this week.
const WEEKS_EACH_WAY = 52;

// S to S, a week to a page, scrolled sideways like any list and settling on a week. The picked day
// sits in an ink disc, today in a grey one when it isn't picked, and a dot marks each day with
// bookings. Settling on another week picks the same weekday there. The list runs left to right
// whatever the language, so its offsets mean the same on iOS and Android; in Arabic the weeks go in
// reversed, and each week's days run right to left.
function WeekStrip({
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
function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
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

type T = TFunction;

// The time we're at: baby blue, its words in the brand blue and a point smaller than elsewhere (user:
// in a cell they read bigger), on the same line heights so nothing moves.
const NOW_TINT = "bg-[#dce5ff]";
const NOW_TEXT = "text-primary";

// The bar beside a row: its look says where the booking stands (lib/calendar.ts, RowKind). A free
// hour's is dashed, as everywhere in the staff app for what isn't there yet.
const BAR: Record<CalendarRow["kind"], string> = {
  free: "border border-dashed border-ink-3 bg-white",
  ended: "bg-chip",
  closed: "bg-chip",
  confirmed: "bg-primary",
  unconfirmed: "bg-[#c9d6ff]",
  request: "border border-primary bg-white",
  hold: "border border-blue-soft bg-white",
  paying: "border border-blue-soft bg-white",
};

// One booking or closed stretch: its hours, the bar, who it's for and how it stands, and the one
// thing to do about it when there is one (answer a request, confirm a weekly game).
// Over: played, gone by, or a free hour that has passed.
const isOver = (row: CalendarRow) => row.kind === "ended" || (row.kind === "free" && row.ended);

function Row({
  row,
  hour,
  timezone,
  ground,
  currency,
  current = false,
  onPress,
}: {
  row: CalendarRow;
  // Under an hour heading (All grounds): no hours column, and its bar one equal piece of the
  // hour's (user: each booking its own blue, not a share); the row says its times only when it
  // isn't exactly that hour ("till 12am", "9:30pm – 11pm").
  hour?: number;
  timezone: string;
  ground: string;
  currency: string;
  // The row under way now: its hours column in baby blue.
  current?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const [wrapped, setWrapped] = useState(false);
  const ended = isOver(row);
  const timing = hour === undefined ? null : timingIn(row, hour, timezone, t);
  const title =
    row.kind === "closed"
      ? t("screens.calendar.closed")
      : row.kind === "free"
        ? t("screens.calendar.free")
        : row.booking.customer.name;
  const action =
    row.kind === "request"
      ? t("screens.calendar.answer")
      : row.kind === "unconfirmed"
        ? t("screens.calendar.confirm")
        : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      // 64 at least, the bar its full height. The padding is inside, around the words: 4 pt, or 12
      // when the grounds run onto another line (three lines in all), so the row and its bar grow
      // with them (user: padding, not a gap between rows).
      className="min-h-16 flex-row items-center active:opacity-70"
    >
      {hour === undefined ? (
        // Pulled out by its padding, so the hours line up with the other rows' either way.
        <View className={`-ms-2 me-1 w-16 rounded-lg py-1 ps-2 pe-1 ${current ? NOW_TINT : ""}`}>
          <Text
            className={`leading-5 ${current ? `text-label font-semibold ${NOW_TEXT}` : `text-body ${ended ? "text-ink-3" : "font-semibold"}`}`}
            numberOfLines={1}
          >
            {hourLabel(row.startsAt, timezone, t)}
          </Text>
          <Text
            className={`leading-[13px] ${current ? `text-[10px] ${NOW_TEXT}` : "text-[11px] text-ink-3"}`}
          >
            {t("screens.calendar.to")}
          </Text>
          <Text
            className={`leading-[17px] ${current ? `text-[12px] ${NOW_TEXT}` : "text-caption text-ink-3"}`}
            numberOfLines={1}
          >
            {hourLabel(row.endsAt, timezone, t)}
          </Text>
        </View>
      ) : null}
      <View
        className={`w-1.5 self-stretch rounded-[3px] ${row.kind === "free" && row.ended ? "border border-dashed border-border bg-white" : BAR[row.kind]}`}
      />
      <View className={`ms-3.5 flex-1 ${wrapped ? "py-3" : "py-1"}`}>
        <Text
          className={`text-subtitle leading-[21px] font-medium ${ended ? "text-ink-2" : ""}`}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          className="text-label leading-[19px] text-ink-2"
          onTextLayout={(event) => setWrapped(event.nativeEvent.lines.length > 1)}
        >
          {[ground, timing, ...standing(row, timezone, currency, t)].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {action ? (
        <Text className="ms-3 text-body leading-5 font-medium underline">{action}</Text>
      ) : null}
    </Pressable>
  );
}

// Under an hour heading: nothing when the row is that hour exactly, "till 12am" when it starts on
// it and runs longer or shorter, "9:30pm – 11pm" when it starts inside it.
const HOUR = 3_600_000;
const timingIn = (row: CalendarRow, hour: number, timezone: string, t: T) => {
  const start = Date.parse(row.startsAt);
  const end = Date.parse(row.endsAt);
  if (start === hour && end - start === HOUR) return null;
  if (start === hour)
    return t("screens.calendar.till", { time: sentenceTime(row.endsAt, timezone, t) });
  return t("screens.calendar.span", {
    from: sentenceTime(row.startsAt, timezone, t),
    to: sentenceTime(row.endsAt, timezone, t),
  });
};

// A row while the day loads: the same 64 pt, so nothing jumps when the real ones arrive.
function RowBone() {
  return (
    <View className="h-16 flex-row items-center">
      <View className="me-1 w-14 gap-1.5">
        <Bone className="h-3.5 w-9 rounded" />
        <Bone className="h-2 w-3 rounded" />
        <Bone className="h-3 w-7 rounded" />
      </View>
      <Bone className="h-16 w-1.5 rounded-[3px]" />
      <View className="ms-3.5 flex-1 gap-2">
        <Bone className="h-4 w-32 rounded" />
        <Bone className="h-3.5 w-48 rounded" />
      </View>
    </View>
  );
}

// What follows the ground on a row's second line: "600 EGP" for a free hour still to come, "Played", "Held till 6:55 pm", "Weekly · 600
// EGP", "App · 600 EGP", "Walk-in · 1,200 EGP".
const priced = (minor: number, currency: string) =>
  `${formatAmount(minor, decimalsOf(currency))} ${currency}`;

const standing = (row: CalendarRow, timezone: string, currency: string, t: T): string[] => {
  if (row.kind === "closed") return [];
  if (row.kind === "free")
    return row.ended
      ? []
      : [
          row.price.from === row.price.to
            ? priced(row.price.from, currency)
            : t("screens.calendar.priceRange", {
                from: formatAmount(row.price.from, decimalsOf(currency)),
                to: priced(row.price.to, currency),
              }),
        ];
  const { booking } = row;
  const price = priced(booking.total, booking.currency);
  if (booking.status === "COMPLETED") return [t("screens.calendar.played")];
  if (booking.status === "NO_SHOW") return [t("screens.calendar.noShow")];
  if (row.kind === "ended") return [t("screens.calendar.played")];
  if (row.kind === "hold" && booking.expiresAt)
    return [t("screens.calendar.heldTill", { time: sentenceTime(booking.expiresAt, timezone, t) })];
  if (row.kind === "paying" && booking.expiresAt)
    return [
      t("screens.calendar.payingTill", { time: sentenceTime(booking.expiresAt, timezone, t) }),
    ];
  if (row.kind === "unconfirmed") return [t("screens.calendar.weekly")];
  if (booking.openGame)
    return [t("screens.calendar.openGame", { count: booking.openGame.players })];
  if (booking.regular) return [t("screens.calendar.weekly"), price];
  return [
    booking.source === "APP" ? t("screens.calendar.app") : t("screens.calendar.walkIn"),
    price,
  ];
};
