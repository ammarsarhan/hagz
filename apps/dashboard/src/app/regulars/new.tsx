import { useQueries, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BarButton, BottomBar } from "@/components/bottom-bar";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { HoldFor } from "@/components/hold-for";
import { MoveSheet } from "@/components/regular-sheets";
import { useHud } from "@/components/hud";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { Chip } from "@/components/week-strip";
import { bookingSettingsQuery } from "@/lib/booking-settings";
import { addDays, localDateOf, weekStartOf, type Slot } from "@/lib/calendar";
import { useCurrentVenue } from "@/lib/current-venue";
import { colors } from "@/lib/colors";
import { hourLabel } from "@/lib/hours";
import { intlLocale } from "@/lib/language";
import { decimalsOf, formatAmount } from "@/lib/money";
import { datesLabel, regularQuery, regularsQuery, type Regular } from "@/lib/regulars";
import { useNow } from "@/lib/use-now";
import { weekSlots } from "@/lib/week-queries";
import { push } from "@/lib/navigation";

// A new weekly game, its first step (Figma D12 656:2): the weekday, then the ground (one at a time,
// as on Move and Hold a time; user, 2026-11-26: no All grounds), then its free hours: each dashed in
// blue with its price, and a dot for each of the weeks reserved ahead (the venue's regularHorizon),
// filled when that week the hour is free, hollow when it's taken. Regulars already playing then are
// shown at their time.
//
// Picking works as on New booking and Hold a time (user, 2026-11-26): a tap picks the ground's
// shortest game from that hour; holding one and dragging stretches it over the free hours next to
// it, back to back, up to the ground's longest. The pick shows solid blue, and a bar says its hours,
// its price a week and how many of the weeks it's free; Next asks who it's for.
//
// With a regularId it changes that regular's time instead (Figma 656:158): see `changing`.

// Until the first answer says the venue's; venues are in Egypt for now.
const FALLBACK_TIMEZONE = "Africa/Cairo";
const FALLBACK_HORIZON = 4;
const SOFT_FILL = "bg-[#f7f8ff]";
const WEEKLY = "bg-[#c9d6ff]";

// How long a free hour is held before dragging starts (the opening hours grid's beat).
const HOLD_MS = 250;
// How long a picked hour takes to fill in, and the bar to come up.
const PICK_MS = 160;

// One hour on the ground, on each of the weeks ahead (null: taken, closed or gone that week).
interface Hour {
  hour: number;
  weeks: (Slot | null)[];
}

export default function NewRegular() {
  const { t } = useTranslation();
  const hud = useHud();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const compact = useCompactTitle();
  const now = useNow((at) => Math.floor(at / 60_000) * 60_000 + 60_000);
  const settings = useQuery(bookingSettingsQuery(venueId)).data;
  const horizon = settings?.regularHorizon ?? FALLBACK_HORIZON;
  const regulars = useQuery(regularsQuery(venueId)).data ?? [];
  // Changing a regular's time (its ⋯, Figma 656:158) rather than adding one: the same picker,
  // opening on its weekday and ground, its own waiting weeks counted as free, and Next asking to
  // move it instead of who it's for.
  const { regularId = "" } = useLocalSearchParams<{ regularId?: string }>();
  const changing = useQuery(regularQuery(venueId, regularId)).data;
  const [moving, setMoving] = useState(false);

  const [timezone, setTimezone] = useState(FALLBACK_TIMEZONE);
  const today = localDateOf(now, timezone);
  const [weekday, setWeekday] = useState(() => new Date(`${today}T12:00:00Z`).getUTCDay());
  const [picked, setPicked] = useState<string | null>(null);
  // The pick, as its first and last hours, and whether who it's for is being asked.
  const [pick, setPickHours] = useState<{ from: number; to: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [asking, setAsking] = useState(false);
  // Opens on the regular's own weekday and ground, once it's known.
  const [opened, setOpened] = useState(false);
  if (changing && !opened) {
    setOpened(true);
    setWeekday(changing.dayOfWeek);
    setPicked(changing.ground.id);
  }
  // Its waiting weeks' bookings: their hours are its own to move into.
  const own = (changing?.reservations ?? [])
    .filter((booking) => booking.status === "UNCONFIRMED")
    .map((booking) => booking.id)
    .join(",");

  // The weekday's next dates, from today, one a week.
  const dates = useMemo(() => {
    const first = addDays(today, (weekday - new Date(`${today}T12:00:00Z`).getUTCDay() + 7) % 7);
    return Array.from({ length: horizon }, (_, week) => addDays(first, week * 7));
  }, [today, weekday, horizon]);
  // The calendar's weeks those dates fall in, read under the Calendar's own keys.
  const weekStarts = [...new Set(dates.map(weekStartOf))];
  const weeks = useQueries({
    queries: weekStarts.map((start) => weekSlots(venueId, start, venueId !== "")),
  });
  const loaded = weeks.every((week) => week.data !== undefined);
  const answer = weeks.find((week) => week.data)?.data;
  if (answer && answer.timezone !== timezone) setTimezone(answer.timezone);
  const currency = answer?.currency ?? "EGP";
  const grounds = answer?.grounds ?? [];
  const ground = grounds.find((one) => one.id === picked) ?? grounds[0];
  const shortest = ground?.minimumSlots ?? 1;
  const longest = ground?.maximumSlots ?? 3;
  const money = (minor: number) => `${formatAmount(minor, decimalsOf(currency))} ${currency}`;

  // The ground's free hours on the weekday, each on every week ahead.
  // Worked out again only when an answer changes (useQueries hands back a new array every render,
  // and a drag renders many times a second).
  const answers = weeks.map((week) => week.dataUpdatedAt).join(",");
  const groundId = ground?.id;
  const run = useMemo(() => {
    if (!groundId || !loaded) return [];
    // One formatter each, not one a slot: they're slow to make.
    const dayOf = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
    const hourFormat = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "numeric",
      hourCycle: "h23",
    });
    const wanted = new Map(dates.map((date, index) => [date, index]));
    // Each week's slots on the ground that day, by the hour they start.
    const byWeek = dates.map(() => new Map<number, Slot>());
    for (const week of weeks) {
      for (const slot of week.data?.slots ?? []) {
        if (slot.groundId !== groundId) continue;
        const at = new Date(slot.startsAt);
        const index = wanted.get(dayOf.format(at));
        if (index === undefined) continue;
        byWeek[index]?.set(Number(hourFormat.format(at).slice(0, 2)), slot);
      }
    }
    const starts = [...new Set(byWeek.flatMap((hours) => [...hours.keys()]))].sort((a, b) => a - b);
    // Free that week: open for booking and still ahead.
    const mine = new Set(own.split(",").filter(Boolean));
    const freeAt = (hours: Map<number, Slot>, hour: number) => {
      const slot = hours.get(hour);
      const open =
        slot?.status === "AVAILABLE" || (slot?.bookingId != null && mine.has(slot.bookingId));
      return slot && open && Date.parse(slot.startsAt) > now ? slot : null;
    };
    return starts
      .map((hour): Hour => ({ hour, weeks: byWeek.map((hours) => freeAt(hours, hour)) }))
      .filter((one) => one.weeks.some(Boolean));
    // `weeks` is read through `answers`, which changes whenever it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groundId, loaded, answers, dates, timezone, now, own]);

  // Free hours next to each other, so a game can run on from one into the next.
  const joined = (a: number) => run[a + 1]?.hour === (run[a]?.hour ?? -2) + 1;
  // From `anchor` towards `toward`, as far as the hours run back to back and the longest game
  // allows; then on past the end if that's shorter than the shortest game.
  const stretch = (anchor: number, toward: number) => {
    let from = anchor;
    let to = anchor;
    while (to < toward && to - from + 1 < longest && joined(to)) to += 1;
    while (from > toward && to - from + 1 < longest && joined(from - 1)) from -= 1;
    while (to - from + 1 < shortest && to - from + 1 < longest && joined(to)) to += 1;
    return { from, to };
  };
  const setPick = (next: { from: number; to: number } | null) => {
    const from = next ? run[next.from] : undefined;
    const to = next ? run[next.to] : undefined;
    setPickHours(from && to ? { from: from.hour, to: to.hour } : null);
  };
  const chosen = (() => {
    if (!pick) return null;
    const from = run.findIndex((one) => one.hour === pick.from);
    const to = run.findIndex((one) => one.hour === pick.to);
    // Gone (taken meanwhile) or no longer back to back: let it go.
    if (from < 0 || to < from) return null;
    for (let index = from; index < to; index += 1) if (!joined(index)) return null;
    return { from, to };
  })();
  const pickedHours = chosen ? run.slice(chosen.from, chosen.to + 1) : [];
  // The picked game on each week: every hour of it free, back to back.
  const pickedWeeks = dates.map((_, week) => {
    const slots = pickedHours.map((one) => one.weeks[week] ?? null);
    if (slots.length === 0 || slots.some((slot) => slot === null)) return null;
    const game = slots as Slot[];
    for (let index = 1; index < game.length; index += 1) {
      if (game[index - 1]?.endsAt !== game[index]?.startsAt) return null;
    }
    return game;
  });
  const freeWeeks = pickedWeeks.filter(Boolean).length;
  const short = chosen !== null && pickedHours.length < shortest;
  const pickedPrice = (pickedWeeks.find(Boolean) ?? []).reduce((sum, slot) => sum + slot.price, 0);
  const pickStart = pickedHours[0]?.hour ?? 0;
  const pickLength = pickedHours.length;

  // Where each free hour sits in the list, for finding the one under the finger.
  const groupTops = useRef(new Map<number, number>());
  const rowPlaces = useRef(new Map<number, { group: number; y: number; height: number }>());
  const indexAt = (y: number) => {
    let nearest = -1;
    let distance = Infinity;
    run.forEach((one, index) => {
      const place = rowPlaces.current.get(one.hour);
      if (!place) return;
      const top = (groupTops.current.get(place.group) ?? 0) + place.y;
      const away = y < top ? top - y : y > top + place.height ? y - (top + place.height) : 0;
      if (away < distance) {
        distance = away;
        nearest = index;
      }
    });
    return { index: nearest, on: distance === 0 };
  };
  const drag = useRef<{ anchor: number; last: number; from: number; to: number } | null>(null);
  const pan = Gesture.Pan()
    .runOnJS(true)
    .activateAfterLongPress(HOLD_MS)
    .onStart((event) => {
      const { index, on } = indexAt(event.y);
      if (!on || index < 0) return;
      const first = stretch(index, index);
      drag.current = { anchor: index, last: index, ...first };
      setDragging(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setPick(first);
    })
    .onUpdate((event) => {
      const current = drag.current;
      if (!current) return;
      const { index } = indexAt(event.y);
      if (index < 0 || index === current.last) return;
      current.last = index;
      const next = stretch(current.anchor, index);
      // A tick each time the pick changes.
      if (next.from !== current.from || next.to !== current.to) void Haptics.selectionAsync();
      current.from = next.from;
      current.to = next.to;
      setPick(next);
    })
    .onFinalize(() => {
      drag.current = null;
      setDragging(false);
    });
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event, success) => {
      if (!success) return;
      const { index, on } = indexAt(event.y);
      if (!on || index < 0) return;
      void Haptics.selectionAsync();
      // Tapping inside the pick lets it go.
      if (chosen && index >= chosen.from && index <= chosen.to) {
        setPick(null);
        return;
      }
      const next = stretch(index, index);
      if (next.to - next.from + 1 < shortest) {
        hud.show(t("screens.hold.tooShort", { count: shortest }));
        return;
      }
      setPick(next);
    });
  // The tap only counts once the hold has failed, i.e. the finger lifted before it.
  const gesture = Gesture.Exclusive(pan, tap);
  const placeGroup = (hour: number) => (event: LayoutChangeEvent) =>
    groupTops.current.set(hour, event.nativeEvent.layout.y);
  // The same function every render, so a row that hasn't changed doesn't draw again.
  const placeRow = useCallback((hour: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    rowPlaces.current.set(hour, { group: hour, y, height });
  }, []);
  const latest = useRef<(hour: number) => void>(() => undefined);
  latest.current = (hour: number) => {
    const index = run.findIndex((one) => one.hour === hour);
    const next = stretch(index, index);
    if (index >= 0 && next.to - next.from + 1 >= shortest) setPick(next);
  };
  const tapHour = useCallback((hour: number) => latest.current(hour), []);

  // Regulars already playing on the ground that weekday, at the hour they start.
  const playing = regulars.filter(
    (regular) =>
      regular.status === "ACTIVE" &&
      regular.id !== changing?.id &&
      regular.dayOfWeek === weekday &&
      regular.ground.id === ground?.id,
  );
  const rows = [
    ...run.map((one) => ({ hour: one.hour, free: one, regular: null })),
    ...playing.map((regular) => ({ hour: regular.startHour, free: null, regular })),
  ].sort((a, b) => a.hour - b.hour || (a.regular ? -1 : 1));
  // Under each hour: its regulars, then its free time.
  const groups: { hour: number; rows: typeof rows }[] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last?.hour === row.hour) last.rows.push(row);
    else groups.push({ hour: row.hour, rows: [row] });
  }

  // One object while asked: HoldFor opens its first sheet again whenever the target changes.
  const groundKey = ground?.id ?? "";
  const target = useMemo(
    () => (asking ? { groundId: groundKey, startsAt: "", endsAt: "" } : null),
    [asking, groundKey],
  );
  // "Tuesdays, 8 – 9 pm on Pitch 2".
  const pickedSpan = `${hourLabel(t, pickStart)} – ${hourLabel(t, pickStart + pickLength)}`;
  const whenLabel = t("screens.regulars.new.when", {
    day: t(`screens.regulars.days.${String(weekday) as Weekday}`),
    hours: pickedSpan,
    ground: ground?.name ?? "",
  });
  const title = changing
    ? t("screens.regulars.change.title", {
        name: changing.customer.name.trim().split(/\s+/)[0] ?? changing.customer.name,
      })
    : t("screens.regulars.new.title");
  // The Calendar weeks (Sunday first) where it has a confirmed game, which keep it.
  const confirmedWeeks = new Set(
    (changing?.reservations ?? [])
      .filter((booking) => booking.status === "CONFIRMED")
      .map((booking) => weekStartOf(localDateOf(booking.startsAt, timezone))),
  );
  const playedWeek = (date: string) => confirmedWeeks.has(weekStartOf(date));
  // The pick is the time it has now: nothing to move.
  const same =
    changing !== undefined &&
    chosen !== null &&
    changing.ground.id === ground?.id &&
    changing.dayOfWeek === weekday &&
    changing.startHour === pickStart &&
    changing.slotCount === pickLength;
  const letter = new Intl.DateTimeFormat(intlLocale, { timeZone: "UTC", weekday: "narrow" });
  const long = new Intl.DateTimeFormat(intlLocale, { timeZone: "UTC", weekday: "long" });
  // Sunday the 4th of January 2026, and the six days after it.
  const weekdays = Array.from({ length: 7 }, (_, day) => new Date(Date.UTC(2026, 0, 4 + day)));

  return (
    <Screen
      footer={
        chosen ? (
          <Animated.View
            entering={FadeInDown.duration(PICK_MS * 1.5)}
            exiting={FadeOutDown.duration(PICK_MS)}
          >
            <BottomBar
              title={t("screens.hold.picked", { hours: pickedSpan, ground: ground?.name ?? "" })}
              detail={
                short
                  ? t("screens.hold.tooShort", { count: shortest })
                  : same
                    ? t("screens.regulars.change.now")
                    : freeWeeks === 0
                      ? t("screens.regulars.new.noWeek")
                      : t("screens.regulars.new.pickedDetail", {
                          price: money(pickedPrice),
                          free: freeWeeks,
                          count: dates.length,
                        })
              }
            >
              <BarButton
                label={t("screens.book.next")}
                primary
                incomplete={short || freeWeeks === 0 || same}
                onPress={() => {
                  if (short || freeWeeks === 0 || same) return;
                  if (changing) setMoving(true);
                  else setAsking(true);
                }}
              />
            </BottomBar>
          </Animated.View>
        ) : undefined
      }
    >
      <NavBar
        flush
        start={
          <CompactTitle
            button={
              <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
            }
            title={title}
            style={compact.style}
          />
        }
      />
      <FadingScroll scrollY={compact.scrollY} scrollEnabled={!dragging}>
        <Title
          small
          onTitleLayout={compact.onTitleLayout}
          subtitle={t("screens.regulars.new.subtitle", { count: horizon })}
        >
          {title}
        </Title>
        <View className="flex-row justify-between">
          {weekdays.map((date, day) => (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={long.format(date)}
              accessibilityState={{ selected: day === weekday }}
              onPress={() => {
                setPick(null);
                setWeekday(day);
              }}
              className={`size-10 items-center justify-center rounded-full active:opacity-70 ${day === weekday ? "bg-ink" : "bg-chip"}`}
            >
              <Text
                className={`text-[15px] leading-5 font-medium ${day === weekday ? "text-white" : ""}`}
              >
                {letter.format(date)}
              </Text>
            </Pressable>
          ))}
        </View>
        {grounds.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -20, marginTop: 18 }}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          >
            {grounds.map((one) => (
              <Chip
                key={one.id}
                label={one.name ?? ""}
                on={one.id === ground?.id}
                onPress={() => {
                  setPick(null);
                  setPicked(one.id);
                }}
              />
            ))}
          </ScrollView>
        ) : null}
        <View className="mt-4 h-px bg-border" style={{ marginHorizontal: -20 }} />

        {!loaded ? (
          <ActivityIndicator className="mt-8" color={colors.ink3} />
        ) : (
          <View className="pt-4 pb-4">
            <Text className="text-[13px] leading-[17px] font-medium text-ink-2">
              {t("screens.regulars.new.dates", {
                day: t(`screens.regulars.days.${String(weekday) as Weekday}`),
                dates: datesLabel(t, dates),
              })}
            </Text>
            {run.length === 0 ? (
              <Text className="mt-4 text-body text-ink-2" style={{ maxWidth: "75%" }}>
                {t("screens.regulars.new.none")}
              </Text>
            ) : null}
            <GestureDetector gesture={gesture}>
              <View className="mt-3.5 gap-4">
                {groups.map((group) => (
                  <View key={group.hour} className="flex-row" onLayout={placeGroup(group.hour)}>
                    {/* When it starts in weight, when it ends in grey under it. */}
                    <View className="w-14 pt-[7px]">
                      <Text className="text-[15px] leading-5 font-semibold">
                        {hourLabel(t, group.hour)}
                      </Text>
                      <Text className="text-[13px] leading-[17px] text-ink-3">
                        {hourLabel(t, group.hour + (group.rows[0]?.regular?.slotCount ?? 1))}
                      </Text>
                    </View>
                    <View className="flex-1 gap-4">
                      {group.rows.map((row) =>
                        row.regular ? (
                          <RegularRow key={row.regular.id} regular={row.regular} />
                        ) : row.free ? (
                          <FreeHour
                            key={`free-${row.hour}`}
                            hour={row.hour}
                            label={t("screens.move.zone", {
                              ground: ground?.name ?? "",
                              price: money(row.free.weeks.find(Boolean)?.price ?? 0),
                            })}
                            weeks={weeksKey(row.free)}
                            on={(() => {
                              const index = run.indexOf(row.free);
                              return chosen !== null && index >= chosen.from && index <= chosen.to;
                            })()}
                            onAccessibilityTap={tapHour}
                            onPlace={placeRow}
                          />
                        ) : null,
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </GestureDetector>
          </View>
        )}
      </FadingScroll>

      {/* Who it's for (the hold's sheets, nothing held), then the last look. */}
      <HoldFor
        venueId={venueId}
        target={target}
        when={asking ? whenLabel : ""}
        holdMinutes={null}
        onClose={() => setAsking(false)}
        onChoose={(choice) => {
          setAsking(false);
          if (!chosen || !ground) return;
          push({
            pathname: "/regulars/confirm",
            params: {
              groundId: ground.id,
              ground: ground.name ?? "",
              kind:
                ground.size === "STANDARD"
                  ? t(`screens.setup.grounds.sports.${ground.sport}`)
                  : t(`screens.setup.grounds.sizes.${ground.size}`),
              dayOfWeek: String(weekday),
              startHour: String(pickStart),
              slotCount: String(pickLength),
              price: String(pickedPrice),
              currency,
              dates: dates.join(","),
              free: pickedWeeks.map((week) => (week ? "1" : "0")).join(","),
              name: choice.name,
              phone: choice.phone ?? "",
              customer: JSON.stringify(choice.customer),
            },
          });
        }}
      />
      {changing && chosen && ground ? (
        <MoveSheet
          regular={changing}
          to={{
            groundId: ground.id,
            ground: ground.name ?? "",
            dayOfWeek: weekday,
            startHour: pickStart,
            slotCount: pickLength,
            price: money(pickedPrice),
            // A week it already has a confirmed game in stays as it is: the server reserves
            // the new time only in the others (a regular plays once a week).
            free: dates.filter((date, week) => pickedWeeks[week] && !playedWeek(date)),
            taken: dates.filter((date, week) => !pickedWeeks[week] && !playedWeek(date)),
          }}
          venueId={venueId}
          timezone={timezone}
          visible={moving}
          onClose={() => setMoving(false)}
          // Moved: back to its page, which shows the new time.
          onMoved={() => router.back()}
        />
      ) : null}
    </Screen>
  );
}

type Weekday = "0" | "1" | "2" | "3" | "4" | "5" | "6";

// A free hour: dashed in blue with its ground and price, and a dot a week ahead, filled when it's
// free that week ("1" in `weeks`). Picked, a solid blue copy fades in over it, white on blue, as the
// Calendar's chips do. Drawn again only when what it shows changes.
const FreeHour = memo(function FreeHour({
  hour,
  label,
  weeks,
  on,
  onAccessibilityTap,
  onPlace,
}: {
  hour: number;
  label: string;
  weeks: string;
  on: boolean;
  onAccessibilityTap: (hour: number) => void;
  onPlace: (hour: number, event: LayoutChangeEvent) => void;
}) {
  const picked = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    picked.value = withTiming(on ? 1 : 0, { duration: PICK_MS });
  }, [on, picked]);
  const fill = useAnimatedStyle(() => ({
    opacity: picked.value,
    transform: [{ scale: 0.98 + picked.value * 0.02 }],
  }));
  const dots = (white: boolean) => (
    <View className="flex-row gap-1.5">
      {[...weeks].map((free, index) => (
        <View
          key={index}
          className={`size-[9px] rounded-full ${
            free === "1"
              ? white
                ? "bg-white"
                : "bg-primary"
              : white
                ? "border border-white/60"
                : "border border-ink-3"
          }`}
        />
      ))}
    </View>
  );
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onAccessibilityTap={() => onAccessibilityTap(hour)}
      onLayout={(event) => onPlace(hour, event)}
      className={`h-[52px] flex-row items-center rounded-[10px] border-[1.5px] border-dashed border-primary px-3.5 ${SOFT_FILL}`}
    >
      <Text className="flex-1 text-[14px] leading-[19px]">{label}</Text>
      {dots(false)}
      {/* Over the dashed border too: an absolute child is placed inside it. */}
      <Animated.View
        pointerEvents="none"
        className="absolute -inset-[1.5px] flex-row items-center rounded-[10px] bg-primary px-[15.5px]"
        style={fill}
      >
        <Text className="flex-1 text-[14px] leading-[19px] text-on-primary">{label}</Text>
        {dots(true)}
      </Animated.View>
    </View>
  );
});

// What a free hour's dots show, as a string, so an unchanged row compares equal.
const weeksKey = (one: Hour) => one.weeks.map((week) => (week ? "1" : "0")).join("");

// A regular already playing then: the weekly pale blue bar, who, and the ground.
function RegularRow({ regular }: { regular: Regular }) {
  const { t } = useTranslation();
  return (
    <View className="h-[52px] flex-row items-center">
      <View className={`h-11 w-1.5 rounded-[3px] ${WEEKLY}`} />
      <View className="ms-3.5">
        <Text className="text-[16px] leading-[21px] font-medium">{regular.customer.name}</Text>
        <Text className="text-[14px] leading-[19px] text-ink-2">
          {t("screens.regulars.new.weekly", { ground: regular.ground.name ?? "" })}
        </Text>
      </View>
    </View>
  );
}
