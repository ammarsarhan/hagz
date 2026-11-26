import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
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
import type { components } from "@hagz/api";
import { Button } from "@/components/button";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { Field } from "@/components/field";
import { useHud } from "@/components/hud";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { SetupLoading } from "@/components/setup-loading";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { cardShadow } from "@/components/venue-map";
import { Chip, WeekStrip } from "@/components/week-strip";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { addDays, hourStartOf, localDateOf, weekStartOf } from "@/lib/calendar";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { decimalsOf, formatAmount } from "@/lib/money";
import { moveTargets, type MoveTarget } from "@/lib/move-targets";
import { useNow } from "@/lib/use-now";
import { weekBookings, weekSlots } from "@/lib/week-queries";
import { hourLabel, hoursSpan, relativeDay, sentenceTime } from "@/lib/when";
import { bookingQuery } from "./index";

// Moving a booking (Figma D9: pick 605:2, confirm 600:2). The day as a list under the week strip
// and the grounds, where the free times the booking fits wait dashed in blue, its own time dashed
// grey, and the other bookings faded. The booking floats at the bottom as a lifted card, with
// Cancel. Tapping a free time holds it at once (nobody can book it while staff check with the
// player), then asks in a sheet: was and now, the new price against the old, and that the old time
// goes back on sale (user, 2026-11-26: no switch; the API always frees it), with an optional reason
// shown to the player. A hold not used is let go: on closing the sheet, picking another time,
// Cancel or leaving.

type Booking = components["schemas"]["StaffBookingDetail"];
type StaffBooking = components["schemas"]["StaffBooking"];

const NO_DOTS: ReadonlySet<string> = new Set();
const HOUR = 3_600_000;
const SOFT_FILL = "bg-[#f2f4ff]";

// The lifted booking sways while it waits to be dropped: tilting a little either way as it rises
// and settles, slowly, for as long as the screen is open.
const SWAY_MS = 1600;
const SWAY_LIFT = 4;
// How much higher the tilted card's raised corner (and its shadow) reaches than its straight top,
// and the room left between the last row and it.
const TILT_REACH = 8;
const CARD_GAP = 20;
// FadingScroll's own room at the bottom, under its fade.
const FADE = 28;

const useFloat = () => {
  const sway = useSharedValue(0);
  useEffect(() => {
    sway.value = withRepeat(
      withTiming(1, { duration: SWAY_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(sway);
  }, [sway]);
  return useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(sway.value, [0, 1], [0, -SWAY_LIFT]) },
      { rotate: `${interpolate(sway.value, [0, 1], [-2, 0.5])}deg` },
    ],
  }));
};

export default function MoveBooking() {
  const { bookingId = "" } = useLocalSearchParams<{ bookingId: string }>();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const booking = useQuery(bookingQuery(venueId, bookingId));
  if (!booking.data) return <SetupLoading query={booking} />;
  return <Mover booking={booking.data} venueId={venueId} />;
}

function Mover({ booking, venueId }: { booking: Booking; venueId: string }) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const compact = useCompactTitle();
  const floatStyle = useFloat();
  // The lifted card sits low, partly over the home indicator's space; the day's last rows scroll
  // clear of it. The screen already ends above that space and the scroll keeps its fade's room at
  // the bottom, so only the rest of the card's reach (its sway and tilt) and a gap are added.
  const cardBottom = Math.max(insets.bottom - 12, 8);
  const [cardHeight, setCardHeight] = useState(72);
  const clearCard = Math.max(
    0,
    cardBottom + cardHeight + SWAY_LIFT + TILT_REACH + CARD_GAP - insets.bottom - FADE,
  );
  const now = useNow((at) => Math.floor(at / 60_000) * 60_000 + 60_000);
  const { timezone, currency } = booking;
  const money = (minor: number) => `${formatAmount(minor, decimalsOf(currency))} ${currency}`;
  const name = booking.customer.name.trim().split(/\s+/)[0] ?? booking.customer.name;

  const [day, setDay] = useState(() => localDateOf(booking.startsAt, timezone));
  // One ground at a time, starting on the booking's own (user: no All grounds here).
  const [groundId, setGroundId] = useState(booking.ground.id);
  const weekStart = weekStartOf(day);
  const slots = useQuery(weekSlots(venueId, weekStart, venueId !== ""));
  const others = useQuery(weekBookings(venueId, weekStart, venueId !== ""));

  // The hold on the picked time, and the time being held right now.
  // No hold when the new time runs over the booking's own slots (see moveTargets).
  const [held, setHeld] = useState<{ target: MoveTarget; hold: Booking | null } | null>(null);
  const [holding, setHolding] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const holdId = useRef<string | null>(null);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "slots"] }),
    ]);

  const release = (id: string | null) => {
    if (!id) return;
    void send(
      api.POST("/v1/staff/venues/{venueId}/holds/{bookingId}/release", {
        params: { path: { venueId, bookingId: id } },
      }),
    ).then(() => refresh());
  };

  // Leaving with a time still held lets it go.
  useEffect(
    () => () => {
      if (holdId.current) release(holdId.current);
    },
    // Once, on leaving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const hold = async (target: MoveTarget) => {
    if (holding) return;
    setHolding(target.key);
    release(holdId.current);
    holdId.current = null;
    if (target.overlapsOwn) {
      setHolding(null);
      setHeld({ target, hold: null });
      setAsking(true);
      return;
    }
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/holds", {
        params: { path: { venueId } },
        body: {
          groundId: target.groundId,
          startsAt: target.startsAt,
          endsAt: target.endsAt,
          customer: { venueCustomerId: booking.customer.venueCustomerId },
        },
      }),
    );
    setHolding(null);
    void refresh();
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    holdId.current = result.data.id;
    setHeld({ target, hold: result.data });
    setAsking(true);
  };

  const grounds = slots.data?.grounds ?? [];
  const groundName = (id: string) => grounds.find((ground) => ground.id === id)?.name ?? "";
  const targets = useMemo(
    () =>
      slots.data
        ? moveTargets({ booking, slots: slots.data.slots, date: day, timezone, now, groundId })
        : [],
    [slots.data, booking, day, timezone, now, groundId],
  );
  // The day's hours: the booking's own time, the others' bookings faded, and the free times it fits.
  const hours = useMemo(() => {
    type Item =
      | { kind: "own"; key: string; startsAt: string }
      | { kind: "other"; key: string; startsAt: string; booking: StaffBooking }
      | { kind: "free"; key: string; startsAt: string; target: MoveTarget };
    const onDay = (at: string, ground: string) =>
      localDateOf(at, timezone) === day && ground === groundId;
    const items: Item[] = [
      ...(onDay(booking.startsAt, booking.ground.id)
        ? [{ kind: "own" as const, key: booking.id, startsAt: booking.startsAt }]
        : []),
      ...(others.data ?? [])
        .filter((other) => other.id !== booking.id && onDay(other.startsAt, other.ground.id))
        .map((other) => ({
          kind: "other" as const,
          key: other.id,
          startsAt: other.startsAt,
          booking: other,
        })),
      ...targets.map((target) => ({
        kind: "free" as const,
        key: target.key,
        startsAt: target.startsAt,
        target,
      })),
    ];
    items.sort(
      (a, b) =>
        Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
        Number(a.kind === "free") - Number(b.kind === "free"),
    );
    const groups: { hour: number; items: Item[] }[] = [];
    for (const item of items) {
      const hour = hourStartOf(item.startsAt, timezone);
      const last = groups.at(-1);
      if (last?.hour === hour) last.items.push(item);
      else groups.push({ hour, items: [item] });
    }
    return groups;
  }, [booking, others.data, targets, day, timezone, groundId]);

  const oldSlots = booking.charges
    .filter((charge) => charge.type === "SLOT")
    .reduce((sum, charge) => sum + charge.amount, 0);
  const span = (from: string, to: string) => hoursSpan(from, to, timezone, t);
  const title = t("screens.move.title", { name });

  return (
    <Screen>
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
      <FadingScroll scrollY={compact.scrollY}>
        <Title
          onTitleLayout={compact.onTitleLayout}
          subtitle={t("screens.move.subtitle", { name })}
        >
          {title}
        </Title>
        <View style={{ marginHorizontal: -20 }}>
          <WeekStrip
            start={weekStart}
            picked={day}
            today={localDateOf(now, timezone)}
            dots={NO_DOTS}
            onPick={setDay}
            onWeek={(start) => setDay(start > weekStart ? start : addDays(start, 6))}
          />
        </View>
        {grounds.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -20, marginTop: 14 }}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          >
            {grounds.map((ground) => (
              <Chip
                key={ground.id}
                label={ground.name ?? ""}
                on={groundId === ground.id}
                onPress={() => setGroundId(ground.id)}
              />
            ))}
          </ScrollView>
        ) : null}
        <View className="mt-4 h-px bg-border" style={{ marginHorizontal: -20 }} />

        {!slots.data ? (
          <ActivityIndicator className="mt-8" color={colors.ink3} />
        ) : (
          <View className="gap-5 pt-5" style={{ paddingBottom: clearCard }}>
            {targets.length === 0 ? (
              <Text className="text-body text-ink-2">{t("screens.move.none")}</Text>
            ) : null}
            {hours.map((group) => (
              <View key={group.hour} className="flex-row">
                <View className="w-12">
                  <Text className="text-label font-semibold">
                    {hourLabel(new Date(group.hour).toISOString(), timezone, t)}
                  </Text>
                  <Text className="text-caption text-ink-3">
                    {hourLabel(new Date(group.hour + HOUR).toISOString(), timezone, t)}
                  </Text>
                </View>
                <View className="ms-3 flex-1 gap-2">
                  {group.items.map((item) =>
                    item.kind === "own" ? (
                      <View
                        key={item.key}
                        className="h-12 justify-center rounded-xl border border-dashed border-ink-3 px-4"
                      >
                        <Text className="text-body text-ink-3">
                          {t("screens.move.yourTime", {
                            name,
                            ground: booking.ground.name ?? "",
                          })}
                        </Text>
                      </View>
                    ) : item.kind === "other" ? (
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
                      <Pressable
                        key={item.key}
                        accessibilityRole="button"
                        accessibilityLabel={t("screens.move.zoneLabel", {
                          hours: span(item.target.startsAt, item.target.endsAt),
                          ground: groundName(item.target.groundId),
                        })}
                        onPress={() => void hold(item.target)}
                        className={`h-12 flex-row items-center rounded-xl border border-dashed border-primary px-4 active:opacity-70 ${SOFT_FILL}`}
                      >
                        <Text className="flex-1 text-body">
                          {t("screens.move.zone", {
                            ground: groundName(item.target.groundId),
                            price: money(item.target.price),
                          })}
                        </Text>
                        {holding === item.target.key ? (
                          <ActivityIndicator color={colors.primary} />
                        ) : (
                          <Text className="text-label text-primary">{t("screens.move.free")}</Text>
                        )}
                      </Pressable>
                    ),
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </FadingScroll>

      {/* The booking, lifted off the calendar while its new time is picked. */}
      <View
        pointerEvents="box-none"
        className="absolute inset-x-5"
        style={{ bottom: cardBottom }}
        onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
      >
        <Animated.View
          className="flex-row items-center rounded-2xl bg-white px-4 py-3.5"
          style={[cardShadow, floatStyle]}
        >
          <View className="h-9 w-1 rounded-full bg-primary" />
          <View className="ms-4 flex-1">
            <Text className="text-subtitle">{booking.customer.name}</Text>
            <Text className="text-label text-ink-2">
              {t("screens.move.card", {
                hours: span(booking.startsAt, booking.endsAt),
                ground: booking.ground.name ?? "",
                price: money(oldSlots),
              })}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            hitSlop={8}
            className="ms-3 active:opacity-70"
          >
            <Text className="text-body font-medium underline">{t("screens.move.cancel")}</Text>
          </Pressable>
        </Animated.View>
      </View>

      {held ? (
        <ConfirmMove
          booking={booking}
          venueId={venueId}
          name={name}
          target={held.target}
          hold={held.hold}
          groundName={groundName(held.target.groundId)}
          oldSlots={oldSlots}
          now={now}
          visible={asking}
          money={money}
          onClose={() => setAsking(false)}
          onMoved={(moved) => {
            holdId.current = null;
            void refresh();
            router.dismiss();
            router.replace(`/booking/${moved}`);
          }}
          onHidden={() => {
            // Closed without moving: let the time go.
            if (holdId.current) {
              release(holdId.current);
              holdId.current = null;
            }
            setHeld(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

function ConfirmMove({
  booking,
  venueId,
  name,
  target,
  hold,
  groundName,
  oldSlots,
  now,
  visible,
  money,
  onClose,
  onMoved,
  onHidden,
}: {
  booking: Booking;
  venueId: string;
  name: string;
  target: MoveTarget;
  hold: Booking | null;
  groundName: string;
  oldSlots: number;
  now: number;
  visible: boolean;
  money: (minor: number) => string;
  onClose: () => void;
  onMoved: (bookingId: string) => void;
  onHidden: () => void;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const moved = useRef<string | null>(null);
  const { timezone } = booking;
  const when = (from: string, to: string, ground: string) =>
    t("screens.booking.menuWhen", {
      day: relativeDay(localDateOf(from, timezone), now, timezone, t),
      hours: hoursSpan(from, to, timezone, t),
      ground,
    });
  const difference = target.price - oldSlots;

  const move = async () => {
    setSending(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/bookings/{bookingId}/move", {
        params: { path: { venueId, bookingId: booking.id } },
        body: {
          groundId: target.groundId,
          startsAt: target.startsAt,
          endsAt: target.endsAt,
          ...(hold ? { holdId: hold.id } : {}),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
      }),
    );
    setSending(false);
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    moved.current = result.data.id;
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={() => {
        if (moved.current) onMoved(moved.current);
        else onHidden();
      }}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t("screens.move.confirmTitle", { name })}
      </Text>
      {hold?.expiresAt ? (
        <Text className="mt-1.5 text-label text-ink-2">
          {t("screens.move.heldUntil", { time: sentenceTime(hold.expiresAt, timezone, t) })}
        </Text>
      ) : null}

      <View className="mt-5 gap-3 rounded-2xl bg-field p-4">
        <View className="flex-row">
          <Text className="w-14 text-label text-ink-2">{t("screens.move.was")}</Text>
          <Text className="flex-1 text-body text-ink-3 line-through">
            {when(booking.startsAt, booking.endsAt, booking.ground.name ?? "")}
          </Text>
        </View>
        <View className="flex-row">
          <Text className="w-14 text-label text-ink-2">{t("screens.move.now")}</Text>
          <View className="flex-1">
            <Text className="text-body">{when(target.startsAt, target.endsAt, groundName)}</Text>
            <Text className="mt-0.5 text-caption text-ink-2">
              {difference === 0
                ? t("screens.move.same", { price: money(target.price) })
                : t(difference > 0 ? "screens.move.more" : "screens.move.less", {
                    price: money(target.price),
                    diff: money(Math.abs(difference)),
                  })}
            </Text>
          </View>
        </View>
      </View>

      <Text className="mt-4 mb-5 text-label text-ink-2">
        {t("screens.move.backOnSale", {
          hours: hoursSpan(booking.startsAt, booking.endsAt, timezone, t),
          name,
        })}
      </Text>

      <View className="mb-2">
        <Field
          label={t("screens.move.reason")}
          value={reason}
          onChangeText={setReason}
          placeholder={t("screens.move.reasonHint", { name })}
          maxLength={500}
        />
      </View>
      <Button label={t("screens.move.submit")} loading={sending} onPress={() => void move()} />
    </Sheet>
  );
}
