import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { BarButton, BottomBar } from "@/components/bottom-bar";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { DayPickHeader, HourColumn } from "@/components/day-pick";
import { FadingScroll } from "@/components/fading-scroll";
import { HoldFor, type HoldTarget } from "@/components/hold-for";
import { useHud } from "@/components/hud";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import {
  hourStartOf,
  localDateOf,
  weekStartOf,
  type Slot,
  type StaffBooking,
} from "@/lib/calendar";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { decimalsOf, formatAmount } from "@/lib/money";
import { useNow } from "@/lib/use-now";
import { bookingSettingsQuery } from "@/lib/booking-settings";
import { weekBookings, weekSlots } from "@/lib/week-queries";
import { hoursSpan, relativeDay } from "@/lib/when";

// Hold a time (Figma D9 600:142, behind its sheet): the time first, then who it's for. The day
// under the week strip and the grounds, one ground at a time like Move and Swap, from the one the
// Calendar was on (else the first): each free time dashed in blue with its price, the bookings
// already there faded. Opened from the Calendar's +, on the Calendar's day.
//
// Tapping a free time picks the ground's shortest game from it; holding one and dragging stretches
// the pick over the free times next to it, back to back, up to the ground's longest (user,
// 2026-11-26). The pick shows solid blue, and a bar says its hours and price, with Hold, which asks
// who it's for (HoldFor) and then opens the held booking.

const HOUR = 3_600_000;
// How long a free time is held before dragging starts (the opening hours grid's beat).
const HOLD_MS = 250;
const SOFT_FILL = "bg-[#f2f4ff]";
// Until the first answer says the venue's; venues are in Egypt for now.
const FALLBACK_TIMEZONE = "Africa/Cairo";

export default function HoldTime() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ date?: string; groundId?: string }>();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const compact = useCompactTitle();
  const now = useNow((at) => Math.floor(at / 60_000) * 60_000 + 60_000);

  const [day, setDay] = useState(() => params.date ?? localDateOf(now, FALLBACK_TIMEZONE));
  const [picked, setPicked] = useState<string | null>(params.groundId ?? null);
  const weekStart = weekStartOf(day);
  const slots = useQuery(weekSlots(venueId, weekStart, venueId !== ""));
  const bookings = useQuery(weekBookings(venueId, weekStart, venueId !== ""));
  const holdMinutes = useQuery(bookingSettingsQuery(venueId)).data?.staffHoldMinutes ?? null;
  // The free time tapped, while who it's for is asked.
  const [target, setTarget] = useState<HoldTarget | null>(null);
  const hud = useHud();
  // The pick, as its first and last free times (by id, so a refresh reordering nothing loses it).
  const [pick, setPickIds] = useState<{ from: string; to: string } | null>(null);
  const [dragging, setDragging] = useState(false);

  const timezone = slots.data?.timezone ?? FALLBACK_TIMEZONE;
  const currency = slots.data?.currency ?? "EGP";
  const grounds = slots.data?.grounds ?? [];
  const groundId =
    grounds.find((ground) => ground.id === picked)?.id ?? grounds[0]?.id ?? picked ?? "";
  const groundName = (id: string) => grounds.find((ground) => ground.id === id)?.name ?? "";
  const money = (minor: number) => `${formatAmount(minor, decimalsOf(currency))} ${currency}`;
  const span = (from: string, to: string) => hoursSpan(from, to, timezone, t);

  // The day's hours on the ground: its free times still to come, and the bookings faded.
  const hours = useMemo(() => {
    type Item =
      | { kind: "free"; key: string; startsAt: string; slot: Slot }
      | { kind: "booked"; key: string; startsAt: string; booking: StaffBooking };
    const onDay = (at: string, ground: string) =>
      localDateOf(at, timezone) === day && ground === groundId;
    const items: Item[] = [
      ...(slots.data?.slots ?? [])
        .filter(
          (slot) =>
            slot.status === "AVAILABLE" &&
            Date.parse(slot.startsAt) > now &&
            onDay(slot.startsAt, slot.groundId),
        )
        .map((slot) => ({ kind: "free" as const, key: slot.id, startsAt: slot.startsAt, slot })),
      ...(bookings.data ?? [])
        .filter((booking) => onDay(booking.startsAt, booking.ground.id))
        .map((booking) => ({
          kind: "booked" as const,
          key: booking.id,
          startsAt: booking.startsAt,
          booking,
        })),
    ];
    items.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    const groups: { hour: number; items: Item[] }[] = [];
    for (const item of items) {
      const hour = hourStartOf(item.startsAt, timezone);
      const last = groups.at(-1);
      if (last?.hour === hour) last.items.push(item);
      else groups.push({ hour, items: [item] });
    }
    return groups;
  }, [slots.data, bookings.data, day, groundId, timezone, now]);
  const free = hours.some((group) => group.items.some((item) => item.kind === "free"));

  // The day's free times on the ground in order, and how long a game there may run.
  const run = useMemo(
    () =>
      hours.flatMap((group) =>
        group.items.flatMap((item) => (item.kind === "free" ? [item.slot] : [])),
      ),
    [hours],
  );
  const ground = grounds.find((one) => one.id === groundId);
  const shortest = ground?.minimumSlots ?? 1;
  const longest = ground?.maximumSlots ?? 3;
  const joined = (a: number) => run[a + 1]?.startsAt === run[a]?.endsAt;

  // From `anchor` towards `toward`, as far as the free times run back to back and the longest
  // game allows; then on past the end if that's shorter than the shortest game.
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
    setPickIds(from && to ? { from: from.id, to: to.id } : null);
  };
  const chosen = (() => {
    if (!pick) return null;
    const from = run.findIndex((slot) => slot.id === pick.from);
    const to = run.findIndex((slot) => slot.id === pick.to);
    // Gone (taken meanwhile) or no longer back to back: let it go.
    if (from < 0 || to < from) return null;
    for (let index = from; index < to; index += 1) if (!joined(index)) return null;
    return { from, to };
  })();
  const pickedSlots = chosen ? run.slice(chosen.from, chosen.to + 1) : [];
  const short = chosen !== null && pickedSlots.length < shortest;

  // Where each free time sits in the list, for finding the one under the finger.
  const groupTops = useRef(new Map<number, number>());
  const rowPlaces = useRef(new Map<string, { group: number; y: number; height: number }>());
  const indexAt = (y: number) => {
    let nearest = -1;
    let distance = Infinity;
    run.forEach((slot, index) => {
      const place = rowPlaces.current.get(slot.id);
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
  const placeRow = (id: string, hour: number) => (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    rowPlaces.current.set(id, { group: hour, y, height });
  };
  const choose = (next: () => void) => {
    setPick(null);
    next();
  };

  const title = t("screens.hold.title");

  return (
    <Screen
      footer={
        chosen ? (
          <BottomBar
            title={t("screens.hold.picked", {
              hours: span(pickedSlots[0]?.startsAt ?? "", pickedSlots.at(-1)?.endsAt ?? ""),
              ground: groundName(groundId),
            })}
            detail={
              short
                ? t("screens.hold.tooShort", { count: shortest })
                : money(pickedSlots.reduce((sum, slot) => sum + slot.price, 0))
            }
          >
            <BarButton
              label={t("screens.hold.hold")}
              primary
              onPress={() => {
                const first = pickedSlots[0];
                const last = pickedSlots.at(-1);
                if (short || !first || !last) return;
                setTarget({ groundId, startsAt: first.startsAt, endsAt: last.endsAt });
              }}
            />
          </BottomBar>
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
        <Title onTitleLayout={compact.onTitleLayout} subtitle={t("screens.hold.subtitle")}>
          {title}
        </Title>
        <DayPickHeader
          weekStart={weekStart}
          day={day}
          today={localDateOf(now, timezone)}
          onDay={(date) => choose(() => setDay(date))}
          grounds={grounds}
          groundId={groundId}
          onGround={(id) => choose(() => setPicked(id))}
        />

        {!slots.data || !bookings.data ? (
          <ActivityIndicator className="mt-8" color={colors.ink3} />
        ) : (
          <GestureDetector gesture={gesture}>
            <View className="gap-5 pt-5 pb-4">
              {free ? null : (
                <Text className="text-body text-ink-2" style={{ maxWidth: "75%" }}>
                  {t("screens.hold.none")}
                </Text>
              )}
              {hours.map((group) => (
                <View key={group.hour} className="flex-row" onLayout={placeGroup(group.hour)}>
                  <HourColumn
                    from={new Date(group.hour).toISOString()}
                    to={new Date(group.hour + HOUR).toISOString()}
                    timezone={timezone}
                  />
                  <View className="ms-3 flex-1 gap-2">
                    {group.items.map((item) =>
                      item.kind === "booked" ? (
                        <View key={item.key} className="flex-row py-1 opacity-40">
                          <View className="w-1 rounded-full bg-border" />
                          <View className="ms-4">
                            <Text className="text-subtitle">{item.booking.customer.name}</Text>
                            <Text className="text-label text-ink-2">
                              {t("screens.move.otherBooking", {
                                ground: item.booking.ground.name ?? "",
                                hours: span(item.booking.startsAt, item.booking.endsAt),
                              })}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <FreeRow
                          key={item.key}
                          on={(() => {
                            const index = run.indexOf(item.slot);
                            return chosen !== null && index >= chosen.from && index <= chosen.to;
                          })()}
                          label={t("screens.move.zone", {
                            ground: groundName(item.slot.groundId),
                            price: money(item.slot.price),
                          })}
                          free={t("screens.move.free")}
                          accessibilityLabel={t("screens.hold.zoneLabel", {
                            hours: span(item.slot.startsAt, item.slot.endsAt),
                            ground: groundName(item.slot.groundId),
                          })}
                          onAccessibilityTap={() => {
                            const index = run.indexOf(item.slot);
                            const next = stretch(index, index);
                            if (next.to - next.from + 1 >= shortest) setPick(next);
                          }}
                          onLayout={placeRow(item.slot.id, group.hour)}
                        />
                      ),
                    )}
                  </View>
                </View>
              ))}
            </View>
          </GestureDetector>
        )}
      </FadingScroll>

      <HoldFor
        venueId={venueId}
        target={target}
        when={
          target
            ? t("screens.hold.when", {
                day: relativeDay(localDateOf(target.startsAt, timezone), now, timezone, t),
                hours: span(target.startsAt, target.endsAt),
                ground: groundName(target.groundId),
              })
            : ""
        }
        holdMinutes={holdMinutes}
        onClose={() => setTarget(null)}
        onHeld={(held) => {
          setTarget(null);
          router.replace(`/booking/${held.id}`);
        }}
      />
    </Screen>
  );
}

// A free time: dashed in soft blue, or solid blue while picked.
function FreeRow({
  on,
  label,
  free,
  accessibilityLabel,
  onAccessibilityTap,
  onLayout,
}: {
  on: boolean;
  label: string;
  free: string;
  accessibilityLabel: string;
  onAccessibilityTap: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: on }}
      onAccessibilityTap={onAccessibilityTap}
      onLayout={onLayout}
      className={`h-12 flex-row items-center rounded-xl border px-4 ${on ? "border-primary bg-primary" : `border-dashed border-primary ${SOFT_FILL}`}`}
    >
      <Text className={`flex-1 text-body ${on ? "text-on-primary" : ""}`}>{label}</Text>
      <Text className={`text-label ${on ? "text-on-primary" : "text-primary"}`}>{free}</Text>
    </View>
  );
}
