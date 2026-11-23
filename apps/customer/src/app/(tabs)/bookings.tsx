import type { components } from "@hagz/api";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { useHud, useHudAnchor } from "@/components/hud";
import { IconChevronRight } from "@/components/icons";
import { KindTag } from "@/components/kind-tag";
import { LightsOutArt } from "@/components/lights-out-art";
import { MatchTicket } from "@/components/match-ticket";
import { NoNameArt } from "@/components/no-name-art";
import { usePullToRefresh } from "@/components/pull-to-refresh";
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
//
// It scrolls the way Search does: the title at the top of the page, and Upcoming | Past riding up
// with it until it docks under the status bar, a white header fading in behind it; pull to
// refresh holds a small spinner at the top (components/pull-to-refresh.tsx).

type Summary = components["schemas"]["BookingSummary"];
type Game = components["schemas"]["Game"];
type When = "upcoming" | "past";
type List =
  | { state: "loading" }
  | { state: "failed"; error: unknown }
  | {
      state: "ready";
      items: Summary[];
      // The games joined (Community), merged in by time; each list pages on its own.
      games: Game[];
      cursor: string | null;
      gamesCursor: string | null;
      loadingMore: boolean;
    };

// One entry in the list: a booking of the player's own, or a game they joined.
type Entry = { kind: "booking"; booking: Summary } | { kind: "game"; game: Game };

type Item =
  | { kind: "next"; entry: Entry }
  | { kind: "heading"; key: string; label: string; first?: boolean }
  | { kind: "row"; entry: Entry; last: boolean };

const startOf = (entry: Entry) =>
  entry.kind === "booking" ? entry.booking.startsAt : entry.game.startsAt;
const timezoneOf = (entry: Entry) =>
  entry.kind === "booking" ? entry.booking.venue.timezone : entry.game.timezone;
const keyOf = (entry: Entry) =>
  entry.kind === "booking" ? entry.booking.id : `game:${entry.game.id}`;

// The bookings loaded so far and the games joined, by time. Bookings come a page at a time, so a
// game only joins once the bookings around it have loaded (else it could sit out of order ahead of
// the next page); with every page in, all of them.
type Ready = Extract<List, { state: "ready" }>;

// How far a paged list reaches: its last row's start, or null when it's all loaded.
const edgeOf = (rows: { startsAt: string }[], cursor: string | null) => {
  const last = rows.at(-1);
  return cursor && last ? Date.parse(last.startsAt) : null;
};

// Bookings and games page separately, so only what both have reached is shown: past the nearer
// edge, a row from the list that's behind could still belong in between. Null: everything's loaded.
const frontierOf = (when: When, list: Ready) => {
  const edges = [edgeOf(list.items, list.cursor), edgeOf(list.games, list.gamesCursor)].filter(
    (edge): edge is number => edge !== null,
  );
  if (edges.length === 0) return null;
  return when === "upcoming" ? Math.min(...edges) : Math.max(...edges);
};

const entriesOf = (when: When, list: Ready): Entry[] => {
  const frontier = frontierOf(when, list);
  const reached = (startsAt: string) => {
    if (frontier === null) return true;
    const at = Date.parse(startsAt);
    return when === "upcoming" ? at <= frontier : at >= frontier;
  };
  const entries: Entry[] = [
    ...list.items
      .filter((booking) => reached(booking.startsAt))
      .map((booking) => ({ kind: "booking" as const, booking })),
    ...list.games
      .filter((game) => reached(game.startsAt))
      .map((game) => ({ kind: "game" as const, game })),
  ];
  const sign = when === "upcoming" ? 1 : -1;
  return entries.sort((a, b) => sign * (Date.parse(startOf(a)) - Date.parse(startOf(b))));
};

// Whether a comes after b in the list's order (the server's: when it starts, then id).
const comesAfter = (
  when: When,
  a: { id: string; startsAt: string },
  b: { id: string; startsAt: string },
) => {
  const sign = when === "upcoming" ? 1 : -1;
  const at = Date.parse(a.startsAt) - Date.parse(b.startsAt);
  return at !== 0 ? sign * at > 0 : sign * a.id.localeCompare(b.id) > 0;
};

// The first page read again, with the pages already loaded under it kept (and where they end), so
// coming back from a booking far down doesn't cut the list short or jump the scroll.
const refreshed = <Row extends { id: string; startsAt: string }>(
  when: When,
  fresh: { data: Row[]; nextCursor: string | null },
  before: { rows: Row[]; cursor: string | null } | null,
) => {
  const last = fresh.data.at(-1);
  if (!fresh.nextCursor || !last || !before) return { rows: fresh.data, cursor: fresh.nextCursor };
  const deeper = before.rows.filter((row) => comesAfter(when, row, last));
  return deeper.length > 0
    ? { rows: [...fresh.data, ...deeper], cursor: before.cursor }
    : { rows: fresh.data, cursor: fresh.nextCursor };
};

const PAGE = 20;
// The tab bar's row (components/tab-bar.tsx), which the HUD sits on.
const TAB_ROW = 49;
// The segment's height (components/segment.tsx), and the gap from the title down to it.
const SEGMENT = 44;
const TITLE_TO_SEGMENT = 18;
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
    <View className="flex-1 bg-white" style={{ direction }}>
      <StatusBar style="dark" />
      {signedIn === undefined ? null : signedIn ? <Bookings /> : <Guest />}
    </View>
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
  const insets = useSafeAreaInsets();
  // The latest request per list wins: a slow answer from an earlier load is dropped.
  const requests = useRef({ upcoming: 0, past: 0 });

  const setList = (which: When, list: List) => setLists((all) => ({ ...all, [which]: list }));

  // The first page of each. What's already shown stays while it loads, and stays if it fails.
  const load = useCallback(async (which: When) => {
    const request = ++requests.current[which];
    const [result, games] = await Promise.all([
      send(api.GET("/v1/bookings", { params: { query: { when: which, limit: PAGE } } })),
      send(api.GET("/v1/games/mine", { params: { query: { when: which, limit: PAGE } } })),
    ]);
    if (request !== requests.current[which]) return;
    setLists((all) => {
      const before = all[which].state === "ready" ? all[which] : null;
      if (result.ok) {
        const bookings = refreshed(
          which,
          result.data,
          before ? { rows: before.items, cursor: before.cursor } : null,
        );
        // The games failing doesn't hold the bookings back: the ones already shown stay.
        const joined = games.ok
          ? refreshed(
              which,
              games.data,
              before ? { rows: before.games, cursor: before.gamesCursor } : null,
            )
          : { rows: before?.games ?? [], cursor: before?.gamesCursor ?? null };
        const list: List = {
          state: "ready",
          items: bookings.rows,
          cursor: bookings.cursor,
          games: joined.rows,
          gamesCursor: joined.cursor,
          loadingMore: false,
        };
        return { ...all, [which]: list };
      }
      return before ? all : { ...all, [which]: { state: "failed", error: result.error } };
    });
  }, []);

  // Near the end: the next page of whichever list is holding the rest back (both when they're
  // level), again until something new can be shown or both have run out.
  const loadMore = async () => {
    const list = lists[when];
    if (list.state !== "ready" || list.loadingMore || (!list.cursor && !list.gamesCursor)) return;
    const which = when;
    const request = requests.current[which];
    setList(which, { ...list, loadingMore: true });
    let next: Ready = list;
    for (let round = 0; round < 5; round++) {
      const shown = entriesOf(which, next).length;
      const frontier = frontierOf(which, next);
      const holding = (rows: { startsAt: string }[], cursor: string | null) =>
        cursor !== null && edgeOf(rows, cursor) === frontier;
      const bookingsCursor = holding(next.items, next.cursor) ? next.cursor : null;
      const gamesCursor = holding(next.games, next.gamesCursor) ? next.gamesCursor : null;
      const [bookings, games] = await Promise.all([
        bookingsCursor
          ? send(
              api.GET("/v1/bookings", {
                params: { query: { when: which, limit: PAGE, cursor: bookingsCursor } },
              }),
            )
          : null,
        gamesCursor
          ? send(
              api.GET("/v1/games/mine", {
                params: { query: { when: which, limit: PAGE, cursor: gamesCursor } },
              }),
            )
          : null,
      ]);
      if (request !== requests.current[which]) return;
      next = {
        ...next,
        ...(bookings?.ok
          ? { items: [...next.items, ...bookings.data.data], cursor: bookings.data.nextCursor }
          : {}),
        ...(games?.ok
          ? { games: [...next.games, ...games.data.data], gamesCursor: games.data.nextCursor }
          : {}),
      };
      const failed = (bookings && !bookings.ok) || (games && !games.ok);
      if (failed || entriesOf(which, next).length > shown) break;
      if (!next.cursor && !next.gamesCursor) break;
    }
    setList(which, { ...next, loadingMore: false });
  };

  // Each time the tab is opened, and on switching: the list on show, read again.
  useFocusEffect(
    useCallback(() => {
      void load(when);
    }, [load, when]),
  );

  // The page's scroll, the segment's place in it, and where it docks: just under the status bar.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const top = insets.top + 16;
  const segmentStart = useSharedValue(top + 34 + TITLE_TO_SEGMENT);
  const dockAt = insets.top + 6;
  const segmentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(dockAt, segmentStart.value - scrollY.value) }],
  }));
  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      segmentStart.value - scrollY.value,
      [dockAt + 24, dockAt],
      [0, 1],
      "clamp",
    ),
  }));

  // Pulled down from the top: the list on show read again, the spinner held until it's back.
  const [reloading, setReloading] = useState(false);
  const pull = usePullToRefresh({
    scrollY,
    busy: reloading,
    onRefresh: () => {
      setReloading(true);
      void load(when).finally(() => setReloading(false));
    },
  });

  const retry = () => {
    setList(when, { state: "loading" });
    void load(when);
  };

  const open = (entry: Entry) =>
    entry.kind === "booking"
      ? push({ pathname: "/bookings/[id]", params: { id: entry.booking.id } })
      : push({ pathname: "/game/[id]", params: { id: entry.game.id } });

  const list = lists[when];
  const items =
    list.state === "ready" ? itemsOf(when, entriesOf(when, list), t("screens.bookings.later")) : [];

  return (
    <View className="flex-1">
      <Animated.FlatList
        data={items}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => (item.kind === "heading" ? item.key : keyOf(item.entry))}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: top,
          paddingBottom: 24,
        }}
        refreshControl={pull.control}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            <Text accessibilityRole="header" className="text-title font-semibold tracking-[-0.4px]">
              {t("screens.bookings.title")}
            </Text>
            {/* The segment's slot: the segment floats over it (below), so it can dock. */}
            <View
              style={{ height: SEGMENT, marginTop: TITLE_TO_SEGMENT }}
              onLayout={(event) => {
                segmentStart.value = top + event.nativeEvent.layout.y;
              }}
            />
          </View>
        }
        renderItem={({ item }) =>
          item.kind === "next" ? (
            <Next entry={item.entry} onPress={() => open(item.entry)} />
          ) : item.kind === "heading" ? (
            <Text
              className={`${item.first ? "pt-[22px]" : "pt-[26px]"} text-caption leading-[18px] text-unit`}
            >
              {item.label}
            </Text>
          ) : (
            <Row entry={item.entry} last={item.last} onPress={() => open(item.entry)} />
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

      {pull.spinner}

      {/* The header the segment docks in: white, fading in as it arrives. */}
      <Animated.View
        pointerEvents="none"
        className="absolute top-0 right-0 left-0 border-b border-hairline bg-white"
        style={[{ height: dockAt + SEGMENT + 10 }, headerStyle]}
      />
      <Animated.View className="absolute top-0 right-6 left-6" style={segmentStyle}>
        <Segment
          options={[
            { key: "upcoming", label: t("screens.bookings.upcoming") },
            { key: "past", label: t("screens.bookings.past") },
          ]}
          value={when}
          onChange={setWhen}
        />
      </Animated.View>
    </View>
  );
}

// Upcoming: the next game, then "Later" over the rest. Past: the latest first under each month
// ("November", with the year once it isn't this one's), at the venue's clock.
function itemsOf(when: When, entries: Entry[], later: string): Item[] {
  if (when === "upcoming") {
    const [next, ...rest] = entries;
    if (!next) return [];
    return [
      { kind: "next", entry: next },
      ...(rest.length > 0 ? [{ kind: "heading" as const, key: "later", label: later }] : []),
      ...rest.map((entry, index) => ({
        kind: "row" as const,
        entry,
        last: index === rest.length - 1,
      })),
    ];
  }
  const thisYear = new Date().getFullYear();
  const items: Item[] = [];
  let month = "";
  entries.forEach((entry, index) => {
    const date = localDateOf(startOf(entry), timezoneOf(entry));
    if (date.slice(0, 7) !== month) {
      month = date.slice(0, 7);
      const label = new Intl.DateTimeFormat(intlLocale, {
        timeZone: "UTC",
        month: "long",
        ...(Number(date.slice(0, 4)) === thisYear ? {} : { year: "numeric" }),
      }).format(new Date(`${date}T12:00:00Z`));
      items.push({ kind: "heading", key: month, label, first: items.length === 0 });
    }
    const following = entries[index + 1];
    const last =
      !following || localDateOf(startOf(following), timezoneOf(following)).slice(0, 7) !== month;
    items.push({ kind: "row", entry, last });
  });
  return items;
}

const groundName = (place: Summary | Game) => place.ground.name ?? kindOf(place.ground);
const venueLine = (place: Summary | Game) => {
  const name = place.venue.name ?? "";
  const area = place.venue.area?.split(",")[0]?.trim();
  return area ? `${name}, ${area}` : name;
};

// Where a joined game stands: whose game it is still to come, played, or called off.
function useGameStanding() {
  const { t } = useTranslation();
  return (game: Game) => {
    if (game.status === "CANCELLED") return t("screens.bookings.game.calledOff");
    if (Date.parse(game.endsAt) > Date.now())
      return t("screens.bookings.game.joined", { name: game.booker.firstName });
    const checkedIn = game.me?.checkIn?.checkedInAt;
    return checkedIn
      ? t("screens.bookings.playedCheckedIn", { time: timeOfDay(checkedIn, game.timezone) })
      : t("screens.bookings.played");
  };
}

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
function Next({ entry, onPress }: { entry: Entry; onPress: () => void }) {
  const { t } = useTranslation();
  const timezone = timezoneOf(entry);
  const days = Math.max(0, daysUntil(startOf(entry), timezone));
  // Words rather than Intl.RelativeTimeFormat, which Hermes doesn't have.
  const relative =
    days === 0
      ? t("screens.bookings.in.today")
      : days === 1
        ? t("screens.bookings.in.tomorrow")
        : t("screens.bookings.in.days", { count: days });
  return (
    <View>
      <Text className="pt-[22px] pb-2.5 text-caption leading-[18px] text-unit">
        {t("screens.bookings.next", { when: relative })}
      </Text>
      <Pressable accessibilityRole="button" onPress={onPress} className="active:opacity-80">
        {entry.kind === "booking" ? (
          <BookingTicket booking={entry.booking} />
        ) : (
          <GameTicket game={entry.game} />
        )}
      </Pressable>
    </View>
  );
}

// A joined game as the ticket: whose game it is under the tear, and what's paid at the venue.
function GameTicket({ game }: { game: Game }) {
  const { t } = useTranslation();
  const { timezone } = game;
  const off = game.status === "CANCELLED";
  return (
    <MatchTicket
      kind="GAME"
      status={{
        label: off ? t("screens.bookings.game.calledOff") : t("screens.bookings.game.youreIn"),
        dot: off ? "grey" : "black",
      }}
      day={dayLabel(localDateOf(game.startsAt, timezone))}
      range={timeRange(game.startsAt, game.endsAt, timezone)}
      ground={`${groundName(game)} · ${kindOf(game.ground)}`}
      venue={venueLine(game)}
      code={game.booker.firstName}
      codeLabel={t("screens.bookings.game.bookedBy")}
      plainCode
      priceLabel={t("screens.bookings.game.atVenue")}
      price={formatPrice(game.sharePrice + game.joinFee, game.currency)}
    />
  );
}

// A booking of the player's own as the ticket: its code under the tear, and what it costs.
function BookingTicket({ booking }: { booking: Summary }) {
  const { t } = useTranslation();
  const { timezone } = booking.venue;
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
    <MatchTicket
      kind="BOOKING"
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
  );
}

// A row: the day (weekday over the date), the hours and ground, the venue, where it stands, and
// what it is (Booking or Game) tagged before the chevron.
function Row({ entry, last, onPress }: { entry: Entry; last: boolean; onPress: () => void }) {
  const bookingStanding = useStanding();
  const gameStanding = useGameStanding();
  const place = entry.kind === "booking" ? entry.booking : entry.game;
  const standing =
    entry.kind === "booking"
      ? bookingStanding(entry.booking)
      : { text: gameStanding(entry.game), act: false };
  const timezone = timezoneOf(entry);
  const start = new Date(startOf(entry));
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
          {`${timeRange(place.startsAt, place.endsAt, timezone)} · ${groundName(place)}`}
        </Text>
        <Text className="pt-0.5 text-caption leading-[18px] text-ink-2" numberOfLines={1}>
          {venueLine(place)}
        </Text>
        {standing.text ? (
          <Text className={`pt-1 text-caption leading-[18px] ${standing.act ? "font-medium" : ""}`}>
            {standing.text}
          </Text>
        ) : null}
      </View>
      <KindTag kind={entry.kind === "booking" ? "BOOKING" : "GAME"} />
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
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 items-center justify-center px-8 pb-6"
      style={{ paddingTop: insets.top }}
    >
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
