import { useQuery, type QueryFilters } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Directions, Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn } from "react-native-reanimated";
import { useHud } from "@/components/hud";
import { IconInbox, IconPlus } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import {
  addDays,
  clockOf,
  dayRows,
  localDateOf,
  nowIndex,
  requestDays,
  weekOf,
  weekStartOf,
  type CalendarRow,
} from "@/lib/calendar";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { intlLocale, isRTL } from "@/lib/language";
import { decimalsOf, formatAmount } from "@/lib/money";
import { useRefreshWhenShown } from "@/lib/use-refresh";
import { useNow } from "@/lib/use-now";

// The Calendar tab (Figma D6 round 2, "B · The day as a list"): a week strip with the picked day in
// an ink disc and a dot under each day with a booking request to answer, the grounds as chips, and
// the day's bookings and closed times as rows in time order, with a grey line where now is.
// Requests live behind the inbox button, its red count hidden at none.
//
// The week's bookings and slots are read at once, so moving between its days doesn't wait. What
// players do in the app (book, cancel, pay) changes them from elsewhere, so they're read again when
// the tab comes back into view and every minute while it's open.

const REFRESH_EVERY = 60_000;
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
    queryKey: calendarKey(venueId, "bookings", weekStart),
    queryFn: async () =>
      (
        await fetched(
          api.GET("/v1/staff/venues/{venueId}/bookings", {
            params: { path: { venueId }, query: { date: weekStart, span: 7 } },
          }),
        )
      ).data,
    enabled: canSeeBookings,
    refetchInterval: REFRESH_EVERY,
    placeholderData: sameVenue(venueId),
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
  const pending = useQuery({
    queryKey: calendarKey(venueId, "bookings", "pending"),
    queryFn: async () =>
      (
        await fetched(
          api.GET("/v1/staff/venues/{venueId}/bookings/pending", {
            params: { path: { venueId } },
          }),
        )
      ).data,
    enabled: canSeeBookings,
    refetchInterval: REFRESH_EVERY,
  });

  const answeredZone = slots.data?.timezone ?? bookings.data?.[0]?.timezone;
  useEffect(() => {
    if (answeredZone) setTimezone(answeredZone);
  }, [answeredZone]);

  const failure = [bookings, slots, pending].find((read) => read.isError)?.error;
  useEffect(() => {
    if (failure) hud.show(hudMessage(failure));
  }, [failure, hud]);

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
  const dots = useMemo(() => requestDays(pending.data ?? [], timezone), [pending.data, timezone]);
  const requests = pending.data?.length ?? 0;
  const groundName = (id: string) => grounds.find((ground) => ground.id === id)?.name ?? "";

  const loading = canSeeBookings && bookings.data === undefined && !bookings.isError;
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([bookings.refetch(), slots.refetch(), pending.refetch()]);
    setRefreshing(false);
  };

  const comingNext = () => hud.show(t("common.comingNext"));
  const showNow = day === today;
  const nowAt = showNow ? nowIndex(rows, now) : -1;

  return (
    <Screen tabbed>
      <View className="flex-row items-center pt-[42px]">
        <Text
          accessibilityRole="header"
          className="flex-1 text-title font-semibold tracking-[-0.4px]"
        >
          {t("screens.calendar.title")}
        </Text>
        <RoundButton
          label={
            requests > 0
              ? t("screens.calendar.requestsWaiting", { count: requests })
              : t("screens.calendar.requests")
          }
          onPress={comingNext}
          badge={requests}
        >
          <IconInbox size={20} color={colors.ink} strokeWidth={1.75} />
        </RoundButton>
        <View className="w-2" />
        <RoundButton label={t("screens.calendar.add")} onPress={comingNext}>
          <IconPlus size={20} color={colors.ink} strokeWidth={1.75} />
        </RoundButton>
      </View>

      <WeekStrip
        start={weekStart}
        picked={day}
        today={today}
        dots={dots}
        onPick={setPicked}
        onWeek={(weeks) => setPicked(addDays(day, weeks * 7))}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -20, marginTop: 17, flexGrow: 0 }}
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

      <ScrollView
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 24,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.ink3} className="mt-6" />
        ) : rows.length === 0 && canSeeBookings && bookings.data ? (
          <>
            {showNow ? <NowLine at={now} timezone={timezone} /> : null}
            <Text className="text-body text-ink-3">{t("screens.calendar.empty")}</Text>
          </>
        ) : (
          rows.flatMap((row, index) => [
            ...(index === nowAt ? [<NowLine key="now" at={now} timezone={timezone} />] : []),
            <Row
              key={row.key}
              row={row}
              timezone={timezone}
              ground={
                row.kind === "free"
                  ? row.groundIds.map(groundName).join(", ")
                  : groundName(row.groundId)
              }
              currency={slots.data?.currency ?? "EGP"}
              onPress={comingNext}
            />,
            ...(index === rows.length - 1 && nowAt === rows.length
              ? [<NowLine key="now" at={now} timezone={timezone} />]
              : []),
          ])
        )}
      </ScrollView>
    </Screen>
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

// S to S, the picked day in an ink disc, today in a grey one when it isn't picked, and a dot under each day with a request to answer. A swipe
// goes a week back or on; in Arabic the strip runs right to left, so the swipe does too.
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
  onWeek: (weeks: number) => void;
}) {
  const days = weekOf(start);
  const letter = new Intl.DateTimeFormat(intlLocale, { timeZone: "UTC", weekday: "narrow" });
  const long = new Intl.DateTimeFormat(intlLocale, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const swipe = Gesture.Race(
    Gesture.Fling()
      .direction(Directions.RIGHT)
      .runOnJS(true)
      .onEnd(() => onWeek(isRTL ? 1 : -1)),
    Gesture.Fling()
      .direction(Directions.LEFT)
      .runOnJS(true)
      .onEnd(() => onWeek(isRTL ? -1 : 1)),
  );

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View key={start} entering={FadeIn.duration(180)} className="mt-[15px] flex-row">
        {days.map((date) => {
          const at = new Date(`${date}T12:00:00Z`);
          const on = date === picked;
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityLabel={long.format(at)}
              accessibilityState={{ selected: on }}
              onPress={() => onPick(date)}
              className="flex-1 items-center"
            >
              <Text className="text-[12px] leading-4 text-ink-3">{letter.format(at)}</Text>
              <View
                className={`mt-1 size-9 items-center justify-center rounded-full ${on ? "bg-ink" : date === today ? "bg-chip" : ""}`}
              >
                <Text
                  className={`text-[17px] leading-5 ${on ? "font-semibold text-white" : "text-ink"}`}
                >
                  {at.getUTCDate()}
                </Text>
              </View>
              <View
                className={`mt-1.5 size-[5px] rounded-full ${dots.has(date) ? "bg-ink" : ""}`}
              />
            </Pressable>
          );
        })}
      </Animated.View>
    </GestureDetector>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={`h-[34px] justify-center rounded-full px-4 ${on ? "bg-ink" : "border border-border"}`}
    >
      <Text className={`text-label font-medium ${on ? "text-white" : "text-ink"}`}>{label}</Text>
    </Pressable>
  );
}

// The grey "Now · 6:40 pm" and its line, between the rows that started and the ones to come.
function NowLine({ at, timezone }: { at: number; timezone: string }) {
  const { t } = useTranslation();
  return (
    <View className="h-0.5 flex-row items-center gap-2.5">
      <Text className="text-[12px] leading-[15px] font-semibold text-ink-3">
        {t("screens.calendar.now", { time: sentenceTime(at, timezone, t) })}
      </Text>
      <View className="h-[1.5px] flex-1 bg-ink-3" />
    </View>
  );
}

type T = ReturnType<typeof useTranslation>["t"];

const period = (pm: boolean, t: T) => t(pm ? "screens.calendar.pm" : "screens.calendar.am");
const hourLabel = (at: string, timezone: string, t: T) => {
  const { time, pm } = clockOf(at, timezone);
  return t("screens.calendar.hour", { time, period: period(pm, t) });
};
const sentenceTime = (at: string | number, timezone: string, t: T) => {
  const { time, pm } = clockOf(at, timezone);
  return t("screens.calendar.time", { time, period: period(pm, t) });
};

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
function Row({
  row,
  timezone,
  ground,
  currency,
  onPress,
}: {
  row: CalendarRow;
  timezone: string;
  ground: string;
  currency: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const ended = row.kind === "ended" || (row.kind === "free" && row.ended);
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
      className="h-10 flex-row items-center active:opacity-70"
    >
      <View className="w-14 self-start">
        <Text
          className={`text-body leading-5 ${ended ? "text-ink-3" : "font-semibold"}`}
          numberOfLines={1}
        >
          {hourLabel(row.startsAt, timezone, t)}
        </Text>
        <Text className="text-caption leading-[17px] text-ink-3" numberOfLines={1}>
          {hourLabel(row.endsAt, timezone, t)}
        </Text>
      </View>
      <View
        className={`h-10 w-1.5 rounded-[3px] ${row.kind === "free" && row.ended ? "border border-dashed border-border bg-white" : BAR[row.kind]}`}
      />
      <View className="ms-3.5 flex-1 self-start" style={{ marginTop: -2 }}>
        <Text
          className={`text-subtitle leading-[21px] font-medium ${ended ? "text-ink-2" : ""}`}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text className="text-label leading-[19px] text-ink-2" numberOfLines={1}>
          {[ground, ...standing(row, timezone, currency, t)].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {action ? (
        <Text className="ms-3 text-body leading-5 font-medium underline">{action}</Text>
      ) : null}
    </Pressable>
  );
}

// What follows the ground on a row's second line: "600 EGP" for a free hour still to come, "Played", "Held till 6:55 pm", "Weekly · 600
// EGP", "App · 600 EGP", "Walk-in · 1,200 EGP".
const priced = (minor: number, currency: string) =>
  `${formatAmount(minor, decimalsOf(currency))} ${currency}`;

const standing = (row: CalendarRow, timezone: string, currency: string, t: T): string[] => {
  if (row.kind === "closed") return [];
  if (row.kind === "free") return row.ended ? [] : [priced(row.price, currency)];
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
