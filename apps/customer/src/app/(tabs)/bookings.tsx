import type { components } from "@hagz/api";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { useHud, useHudAnchor } from "@/components/hud";
import { IconChevronRight } from "@/components/icons";
import { LightsOutArt } from "@/components/lights-out-art";
import { MatchTicket } from "@/components/match-ticket";
import { NoNameArt } from "@/components/no-name-art";
import { FailedMessage } from "@/components/page-state";
import { Segment } from "@/components/segment";
import { Text } from "@/components/text";
import { api, auth } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { intlLocale, isRTL } from "@/lib/language";
import { formatPrice } from "@/lib/money";
import {
  dayLabel,
  daysUntil,
  deadlineLabel,
  kindOf,
  localDateOf,
  timeOfDay,
  timeRange,
} from "@/lib/venue";
import { push } from "@/lib/navigation";

// The Bookings tab (Figma C8 "Bookings · Upcoming", 255:2, and C10 "Bookings · Past", 267:2):
// Upcoming | Past. Upcoming puts the next game first as the match ticket, then the rest under
// "Later"; Past lists the latest first under each month. Each row is the date, the hours and
// ground, the venue, and one line on where it stands. Read again each time the tab is opened (a
// booking just made, signing in elsewhere) and on pull to refresh; more pages load near the end.
// A guest gets Account's "Uh oh!" with a way in.

type Summary = components["schemas"]["BookingSummary"];
type When = "upcoming" | "past";
type List =
  | { state: "loading" }
  | { state: "failed"; error: unknown }
  | { state: "ready"; items: Summary[]; cursor: string | null; loadingMore: boolean };

type Item =
  | { kind: "next"; booking: Summary }
  | { kind: "heading"; key: string; label: string; first?: boolean }
  | { kind: "row"; booking: Summary; last: boolean };

const PAGE = 20;
// The tab bar's row (components/tab-bar.tsx), which the HUD sits on.
const TAB_ROW = 49;
const direction = isRTL ? "rtl" : "ltr";

export default function BookingsTab() {
  // Undefined while checking; false for a guest.
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const insets = useSafeAreaInsets();
  useHudAnchor(TAB_ROW + insets.bottom);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void auth.isSignedIn().then((yes) => {
        if (active) setSignedIn(yes);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.white, direction }}>
      <StatusBar style="dark" />
      {signedIn === undefined ? null : signedIn ? <Bookings /> : <Guest />}
    </SafeAreaView>
  );
}

function Bookings() {
  const { t } = useTranslation();
  const hud = useHud();
  const [when, setWhen] = useState<When>("upcoming");
  const [lists, setLists] = useState<Record<When, List>>({
    upcoming: { state: "loading" },
    past: { state: "loading" },
  });
  const [refreshing, setRefreshing] = useState(false);
  // The latest request per list wins: a slow answer from an earlier load is dropped.
  const requests = useRef({ upcoming: 0, past: 0 });

  const setList = (which: When, list: List) => setLists((all) => ({ ...all, [which]: list }));

  // The first page. What's already shown stays while it loads, and stays if it fails.
  const load = useCallback(async (which: When) => {
    const request = ++requests.current[which];
    const result = await send(
      api.GET("/v1/bookings", { params: { query: { when: which, limit: PAGE } } }),
    );
    if (request !== requests.current[which]) return;
    setLists((all) => {
      if (result.ok) {
        const list: List = {
          state: "ready",
          items: result.data.data,
          cursor: result.data.nextCursor,
          loadingMore: false,
        };
        return { ...all, [which]: list };
      }
      return all[which].state === "ready"
        ? all
        : { ...all, [which]: { state: "failed", error: result.error } };
    });
  }, []);

  const loadMore = async () => {
    const list = lists[when];
    if (list.state !== "ready" || !list.cursor || list.loadingMore) return;
    const which = when;
    const request = requests.current[which];
    setList(which, { ...list, loadingMore: true });
    const result = await send(
      api.GET("/v1/bookings", {
        params: { query: { when: which, limit: PAGE, cursor: list.cursor } },
      }),
    );
    if (request !== requests.current[which]) return;
    setList(
      which,
      result.ok
        ? {
            state: "ready",
            items: [...list.items, ...result.data.data],
            cursor: result.data.nextCursor,
            loadingMore: false,
          }
        : { ...list, loadingMore: false },
    );
  };

  // Each time the tab is opened, and on switching: the list on show, read again.
  useFocusEffect(
    useCallback(() => {
      void load(when);
    }, [load, when]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load(when);
    setRefreshing(false);
  };

  const retry = () => {
    setList(when, { state: "loading" });
    void load(when);
  };

  const openBooking = () => hud.show(t("screens.booked.bookingPageSoon"));

  const list = lists[when];
  const items =
    list.state === "ready" ? itemsOf(when, list.items, t("screens.bookings.later")) : [];

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => (item.kind === "heading" ? item.key : item.booking.id)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.ink} />
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <View>
          <Text
            accessibilityRole="header"
            className="pt-3 text-title font-semibold tracking-[-0.4px]"
          >
            {t("screens.bookings.title")}
          </Text>
          <Segment
            className="mt-[18px]"
            options={[
              { key: "upcoming", label: t("screens.bookings.upcoming") },
              { key: "past", label: t("screens.bookings.past") },
            ]}
            value={when}
            onChange={setWhen}
          />
        </View>
      }
      renderItem={({ item }) =>
        item.kind === "next" ? (
          <Next booking={item.booking} onPress={openBooking} />
        ) : item.kind === "heading" ? (
          <Text
            className={`${item.first ? "pt-[22px]" : "pt-[26px]"} text-caption leading-[18px] text-unit`}
          >
            {item.label}
          </Text>
        ) : (
          <Row booking={item.booking} last={item.last} onPress={openBooking} />
        )
      }
      ListEmptyComponent={
        list.state === "loading" ? (
          <View className="flex-1 items-center justify-center pb-16">
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : list.state === "failed" ? (
          <View className="flex-1 items-center justify-center pb-10">
            <FailedMessage error={list.error} />
            <View className="mt-6 self-stretch">
              <Button label={t("common.actions.tryAgain")} variant="secondary" onPress={retry} />
            </View>
          </View>
        ) : when === "upcoming" ? (
          <Empty />
        ) : (
          <Text className="pt-6 text-subtitle text-ink-2">{t("screens.bookings.noPast")}</Text>
        )
      }
      ListFooterComponent={
        list.state === "ready" && list.loadingMore ? (
          <View className="py-6">
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : undefined
      }
    />
  );
}

// Upcoming: the next game, then "Later" over the rest. Past: the latest first under each month
// ("November", with the year once it isn't this one's), at the venue's clock.
function itemsOf(when: When, bookings: Summary[], later: string): Item[] {
  if (when === "upcoming") {
    const [next, ...rest] = bookings;
    if (!next) return [];
    return [
      { kind: "next", booking: next },
      ...(rest.length > 0 ? [{ kind: "heading" as const, key: "later", label: later }] : []),
      ...rest.map((booking, index) => ({
        kind: "row" as const,
        booking,
        last: index === rest.length - 1,
      })),
    ];
  }
  const thisYear = new Date().getFullYear();
  const items: Item[] = [];
  let month = "";
  bookings.forEach((booking, index) => {
    const { timezone } = booking.venue;
    const date = localDateOf(booking.startsAt, timezone);
    if (date.slice(0, 7) !== month) {
      month = date.slice(0, 7);
      const label = new Intl.DateTimeFormat(intlLocale, {
        timeZone: "UTC",
        month: "long",
        ...(Number(date.slice(0, 4)) === thisYear ? {} : { year: "numeric" }),
      }).format(new Date(`${date}T12:00:00Z`));
      items.push({ kind: "heading", key: month, label, first: items.length === 0 });
    }
    const following = bookings[index + 1];
    const last =
      !following || localDateOf(following.startsAt, following.venue.timezone).slice(0, 7) !== month;
    items.push({ kind: "row", booking, last });
  });
  return items;
}

const groundName = (booking: Summary) => booking.ground.name ?? kindOf(booking.ground);
const venueLine = (booking: Summary) => {
  const name = booking.venue.name ?? "";
  const area = booking.venue.area?.split(",")[0]?.trim();
  return area ? `${name}, ${area}` : name;
};

// "Confirm by Tuesday": tonight or tomorrow with the time, this week by its day, else the date.
const byDay = (iso: string, timezone: string) => {
  const days = daysUntil(iso, timezone);
  if (days <= 1) return deadlineLabel(iso, timezone);
  if (days < 7)
    return new Intl.DateTimeFormat(intlLocale, { timeZone: timezone, weekday: "long" }).format(
      new Date(iso),
    );
  return dayLabel(localDateOf(iso, timezone));
};

// Where a booking stands, in one line, and whether it needs the player (then medium).
function useStanding() {
  const { t } = useTranslation();
  return (booking: Summary): { text: string; act: boolean } => {
    const { timezone } = booking.venue;
    const ended = Date.parse(booking.endsAt) <= Date.now();
    const said = (text: string, act = false) => ({ text, act });
    if (booking.move && !ended)
      return said(
        t("screens.bookings.moved", {
          deadline: deadlineLabel(booking.move.respondBy, timezone),
        }),
        true,
      );
    switch (booking.status) {
      case "CONFIRMED":
      case "COMPLETED": {
        if (!ended) return said(t("screens.bookings.confirmed"));
        const checkedIn = booking.checkIn?.checkedInAt;
        return said(
          checkedIn
            ? t("screens.bookings.playedCheckedIn", { time: timeOfDay(checkedIn, timezone) })
            : t("screens.bookings.played"),
        );
      }
      case "PENDING":
        return said(t(ended ? "screens.bookings.unanswered" : "screens.bookings.waiting"));
      case "HELD":
        return ended || !booking.expiresAt
          ? said(t("screens.bookings.unpaid"))
          : said(
              t("screens.bookings.payBy", {
                deadline: deadlineLabel(booking.expiresAt, timezone),
              }),
              true,
            );
      case "UNCONFIRMED":
        return ended || !booking.expiresAt
          ? said(t("screens.bookings.released"))
          : said(t("screens.bookings.weekly", { day: byDay(booking.expiresAt, timezone) }), true);
      case "NO_SHOW":
        return said(t("screens.bookings.noShow"));
      case "RELEASED":
        return said(t("screens.bookings.released"));
      case "EXPIRED":
        return said(
          booking.expiredFrom === "PENDING"
            ? t("screens.bookings.unanswered")
            : booking.expiredFrom === "HELD"
              ? t("screens.bookings.unpaid")
              : t("screens.bookings.expired"),
        );
      case "CANCELLED": {
        const by = booking.cancellation?.by;
        return said(
          booking.cancellation?.declined
            ? t("screens.bookings.declined")
            : by === "CUSTOMER"
              ? t("screens.bookings.youCancelled")
              : by === "ADMIN"
                ? t("screens.bookings.supportCancelled")
                : t("screens.bookings.venueCancelled"),
        );
      }
      default:
        return said("");
    }
  };
}

// The next game: "Next game · in 4 days" over its match ticket.
function Next({ booking, onPress }: { booking: Summary; onPress: () => void }) {
  const { t } = useTranslation();
  const { timezone } = booking.venue;
  const days = Math.max(0, daysUntil(booking.startsAt, timezone));
  const relative = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" }).format(days, "day");
  const confirmed = booking.status === "CONFIRMED" && !booking.move;
  const status = booking.move
    ? t("screens.bookings.ticket.moved")
    : booking.status === "PENDING"
      ? t("screens.bookings.waiting")
      : booking.status === "HELD"
        ? t("screens.bookings.ticket.unpaid")
        : booking.status === "UNCONFIRMED"
          ? t("screens.bookings.ticket.weekly")
          : t("screens.bookings.confirmed");
  const checkIn = booking.checkIn;

  return (
    <View>
      <Text className="pt-[22px] pb-2.5 text-caption leading-[18px] text-unit">
        {t("screens.bookings.next", { when: relative })}
      </Text>
      <Pressable accessibilityRole="button" onPress={onPress} className="active:opacity-80">
        <MatchTicket
          status={{ label: status, dot: confirmed ? "black" : "grey" }}
          day={dayLabel(localDateOf(booking.startsAt, timezone))}
          range={timeRange(booking.startsAt, booking.endsAt, timezone)}
          ground={`${groundName(booking)} · ${kindOf(booking.ground)}`}
          venue={venueLine(booking)}
          code={booking.code}
          codeLabel={
            checkIn
              ? checkIn.checkedInAt
                ? t("screens.bookings.checkedIn", {
                    time: timeOfDay(checkIn.checkedInAt, timezone),
                  })
                : t("screens.bookings.checkInOpens", { time: timeOfDay(checkIn.opensAt, timezone) })
              : t("screens.booked.code")
          }
          priceLabel={t(`screens.booked.paid.${booking.paymentMode}`)}
          price={formatPrice(booking.total, booking.currency)}
        />
      </Pressable>
    </View>
  );
}

// A row: the day (weekday over the date), the hours and ground, the venue, where it stands.
function Row({ booking, last, onPress }: { booking: Summary; last: boolean; onPress: () => void }) {
  const standing = useStanding()(booking);
  const { timezone } = booking.venue;
  const start = new Date(booking.startsAt);
  const weekday = new Intl.DateTimeFormat(intlLocale, { timeZone: timezone, weekday: "short" })
    .format(start)
    .replace(/[.,]/g, "");
  const day = new Intl.DateTimeFormat(intlLocale, { timeZone: timezone, day: "numeric" }).format(
    start,
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-row items-center gap-4 py-3.5 active:opacity-70 ${last ? "" : "border-b border-border"}`}
    >
      <View className="w-[52px] items-center">
        <Text className="text-caption leading-[18px] text-unit">{weekday}</Text>
        <Text className="text-[22px] leading-[26px] font-semibold">{day}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-body leading-5 font-medium" numberOfLines={1}>
          {`${timeRange(booking.startsAt, booking.endsAt, timezone)} · ${groundName(booking)}`}
        </Text>
        <Text className="pt-0.5 text-caption leading-[18px] text-ink-2" numberOfLines={1}>
          {venueLine(booking)}
        </Text>
        {standing.text ? (
          <Text className={`pt-1 text-caption leading-[18px] ${standing.act ? "font-medium" : ""}`}>
            {standing.text}
          </Text>
        ) : null}
      </View>
      <View style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}>
        <IconChevronRight size={18} color={colors.ink3} strokeWidth={1.75} />
      </View>
    </Pressable>
  );
}

// Nothing coming up: the floodlight with its lamps off, and a way to find a pitch.
function Empty() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center px-2 pb-10">
      <LightsOutArt />
      <Text accessibilityRole="header" className="mt-3 text-heading font-semibold">
        {t("screens.bookings.emptyTitle")}
      </Text>
      <Text className="mt-2 text-center text-subtitle text-ink-2">
        {t("screens.bookings.emptyBody")}
      </Text>
      <View className="mt-6 self-stretch">
        <Button label={t("screens.bookings.find")} onPress={() => router.navigate("/search")} />
      </View>
    </View>
  );
}

// A guest: Account's "Uh oh!" (the shirt with no name), worded for bookings.
function Guest() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center px-8 pb-6">
      <NoNameArt />
      <Text accessibilityRole="header" className="mt-3 text-heading font-semibold">
        {t("screens.account.guestTitle")}
      </Text>
      <Text className="mt-2 text-center text-subtitle text-ink-2">
        {t("screens.bookings.guest")}
      </Text>
      <View className="mt-6 gap-2.5 self-stretch">
        <Button
          label={t("common.actions.createAccount")}
          variant="moment"
          onPress={() => push("/sign-up")}
        />
        <Button
          label={t("common.actions.signIn")}
          variant="secondary"
          onPress={() => push("/sign-in")}
        />
      </View>
    </View>
  );
}
