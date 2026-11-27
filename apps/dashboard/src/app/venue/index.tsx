import type { components } from "@hagz/api";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import type { TFunction } from "i18next";
import type { ComponentType } from "react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Easing, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bone } from "@/components/bone";
import { FadingScroll } from "@/components/fading-scroll";
import { HeaderButton } from "@/components/header-button";
import { useHud } from "@/components/hud";
import {
  IconBallFootball,
  IconBell,
  IconCalendar,
  IconCircleCheck,
  IconWallet,
  IconCash,
  IconCheck,
  IconHourglass,
  IconInbox,
  IconPlayerPause,
  IconRepeat,
  IconScan,
  IconX,
} from "@/components/icons";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useInvitationSheet } from "@/components/use-invitation-sheet";
import { Chip } from "@/components/week-strip";
import { addDays, clockOf, localDateOf } from "@/lib/calendar";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { decimalsOf, formatAmount } from "@/lib/money";
import { push } from "@/lib/navigation";
import { api } from "@/lib/api";
import { fetched, queries } from "@/lib/queries";
import { useNow } from "@/lib/use-now";
import { useRefreshWhenShown } from "@/lib/use-refresh";
import { calendarKey, WEEK_REFRESH } from "@/lib/week-queries";
import { hoursSpan, sentenceTime } from "@/lib/when";

type Home = components["schemas"]["StaffHome"];
type Game = Home["next"][number];
type Icon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// The venue's Home tab (Figma D21c 739:2, user 2026-11-27): the title with scan and notifications,
// Today and Tomorrow, then what needs someone as large grey cards, most urgent first (requests and
// holds run out; games to mark; cash still to take, for those who see payments; regulars' weeks to
// confirm), or one quiet row when nothing does. Then the next games, a game about to start offering
// Check in, and the hours still free. A paused venue says so in a banner above it all.
//
// One read per day, asked again every minute and whenever the tab comes back into view, since what
// players do in the app changes it from elsewhere.

// Venues are in Egypt for now; the answer names the venue's own timezone.
const FALLBACK_TIMEZONE = "Africa/Cairo";
// Check in shows on a game this close to kick-off, until it ends.
const CHECK_IN_AHEAD = 30 * 60_000;

const homeQuery = (venueId: string, date: string, enabled: boolean) => ({
  queryKey: calendarKey(venueId, "home", date),
  queryFn: () =>
    fetched(
      api.GET("/v1/staff/venues/{venueId}/home", {
        params: { path: { venueId }, query: { date } },
      }),
    ),
  enabled,
  refetchInterval: WEEK_REFRESH,
});

const REFRESH = [{ queryKey: ["staff", "venues"], predicate: isHome }];
function isHome(query: { queryKey: readonly unknown[] }) {
  return query.queryKey[3] === "home";
}

export default function VenueHome() {
  const { t } = useTranslation();
  const hud = useHud();
  const me = useQuery(queries.me);
  const invitation = useInvitationSheet({
    phone: me.data?.phone.replace(/^\+20/, ""),
    takeLinks: me.data !== undefined,
  });
  const comingNext = () => hud.show(t("common.comingNext"));
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const permissions = venue?.permissions;
  const now = useNow((at) => Math.floor(at / 60_000) * 60_000 + 60_000);
  const [tomorrow, setTomorrow] = useState(false);
  const [timezone, setTimezone] = useState(FALLBACK_TIMEZONE);
  const today = localDateOf(now, timezone);
  const date = tomorrow ? addDays(today, 1) : today;
  const canSee = permissions !== undefined && permissions.bookings !== "none";
  const home = useQuery(homeQuery(venueId, date, venueId !== "" && canSee));
  useRefreshWhenShown(REFRESH);
  if (home.data && home.data.timezone !== timezone) setTimezone(home.data.timezone);

  // The paused banner scrolls away first: as far as it's tall, the header and everything under it
  // rise with it (the content shifted back, so it still follows the finger), then the page scrolls
  // on as usual under the header in its place.
  const scrollY = useRef(new Animated.Value(0)).current;
  const [, setGone] = useState(0);
  const banner = venue?.status === "MAINTENANCE" && !dismissedPauses.has(venueId);
  const [bannerHeight, setBannerHeight] = useState(0);
  const lift = banner ? bannerHeight : 0;
  // A short day can't scroll the whole banner away: it goes as far as the page scrolls, fading to
  // white on the way, so no grey sliver is left with its words cut off.
  const [room, setRoom] = useState(0);
  const travel = Math.max(Math.min(lift, room), 1);
  const up = scrollY.interpolate({
    inputRange: [0, travel],
    outputRange: [0, -Math.min(lift, travel)],
    extrapolate: "clamp",
  });
  const whiten = scrollY.interpolate({
    inputRange: [0, travel],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const down = Animated.multiply(up, -1);

  return (
    <Screen tabbed>
      {banner ? (
        <PausedBanner
          key={venueId}
          up={up}
          whiten={whiten}
          onHeight={setBannerHeight}
          onDismissed={() => {
            dismissedPauses.add(venueId);
            setGone((n) => n + 1);
          }}
        />
      ) : null}
      <Animated.View style={{ flex: 1, marginBottom: -lift, transform: [{ translateY: up }] }}>
        {/* The Calendar's header: its 13 pt under the status bar, the title beside its buttons,
            and 12 pt under them before the scroll's hairline once scrolled. */}
        <View className="mt-[13px] mb-3 h-10 flex-row items-center">
          <Text
            accessibilityRole="header"
            className="flex-1 text-title font-semibold tracking-[-0.4px]"
            numberOfLines={1}
          >
            {t("screens.home.title")}
          </Text>
          <HeaderButton label={t("screens.home.scan")} onPress={comingNext}>
            <IconScan size={20} color={colors.ink} strokeWidth={1.75} />
          </HeaderButton>
          <View className="ms-2">
            <HeaderButton label={t("screens.home.notifications")} onPress={comingNext}>
              <IconBell size={20} color={colors.ink} strokeWidth={1.75} />
            </HeaderButton>
          </View>
        </View>

        {canSee ? (
          <FadingScroll scrollY={scrollY} onRoom={setRoom}>
            <Animated.View style={{ transform: [{ translateY: down }] }}>
              {/* Up by what the header's 12 pt adds over 8, so at rest the chips sit where they
                  did; only scrolled does the header keep the extra room. */}
              <View className="-mt-1 flex-row gap-2">
                <Chip
                  label={t("screens.home.today")}
                  on={!tomorrow}
                  onPress={() => setTomorrow(false)}
                />
                <Chip
                  label={t("screens.home.tomorrow")}
                  on={tomorrow}
                  onPress={() => setTomorrow(true)}
                />
              </View>
              {home.data ? <Day home={home.data} isToday={!tomorrow} now={now} /> : <Loading />}
            </Animated.View>
            {/* Room for the shift above, so the end can still be reached. */}
            <View style={{ height: lift }} />
          </FadingScroll>
        ) : null}
      </Animated.View>
      {invitation.sheet}
    </Screen>
  );
}

function Day({ home, isToday, now }: { home: Home; isToday: boolean; now: number }) {
  const { t } = useTranslation();
  const { timezone } = home;
  const cards = useCards(home, isToday);
  const openCalendar = () => router.navigate("/venue/calendar");

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -20, marginTop: 16 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
      >
        {cards.map((card) => (
          <Card
            key={card.key}
            icon={card.icon}
            big={card.big}
            small={card.small}
            onPress={card.onPress}
          />
        ))}
      </ScrollView>

      <Heading
        title={t(isToday ? "screens.home.nextUp" : "screens.home.firstUp")}
        link={t("screens.home.calendar")}
        onLink={openCalendar}
      />
      {home.next.length === 0 ? (
        <Text className="mt-3 text-body text-ink-2">
          {t(isToday ? "screens.home.noMoreToday" : "screens.home.noneOnDay")}
        </Text>
      ) : (
        home.next.map((game) => (
          <GameRow key={game.id} game={game} isToday={isToday} now={now} timezone={timezone} />
        ))
      )}

      {home.free.length > 0 ? (
        <>
          <Heading title={t(isToday ? "screens.home.freeTonight" : "screens.home.stillFree")} />
          {home.free.map((run) => (
            <TimeRow
              key={`${run.groundId}-${run.startsAt}`}
              at={run.startsAt}
              timezone={timezone}
              title={run.groundName ?? ""}
              line={hoursSpan(run.startsAt, run.endsAt, timezone, t)}
              amount={money(run.price, run.currency)}
              onPress={openCalendar}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

const money = (minor: number, currency: string) =>
  `${formatAmount(minor, decimalsOf(currency))} ${currency}`;

interface CardProps {
  key: string;
  icon: Icon;
  big: string;
  small: string;
  onPress: () => void;
}

// The cards in the order things run out: requests, holds, games to mark, cash, weeks to confirm.
// With one booking behind a card it opens that booking; with more, the list or the Calendar.
function useCards(home: Home, isToday: boolean): CardProps[] {
  const { t } = useTranslation();
  return useMemo(() => {
    const cards: CardProps[] = [];
    const booking = (id: string | null, elsewhere: () => void) => () =>
      id ? push(`/booking/${id}`) : elsewhere();
    const calendar = () => router.navigate("/venue/calendar");
    const { requests, holds, toMark, weeks, cash, timezone } = home;
    if (requests.count > 0)
      cards.push({
        key: "requests",
        icon: IconInbox,
        big: String(requests.count),
        small: t("screens.home.requests", { count: requests.count }),
        onPress: () => push("/requests"),
      });
    if (holds.count > 0 && holds.soonest)
      cards.push({
        key: "holds",
        icon: IconHourglass,
        big: String(holds.count),
        small: t(holds.count === 1 ? "screens.home.holdEnds" : "screens.home.holdsEnd", {
          time: sentenceTime(holds.soonest, timezone, t),
        }),
        onPress: booking(holds.bookingId, calendar),
      });
    if (toMark.count > 0)
      cards.push({
        key: "toMark",
        icon: IconCheck,
        big: String(toMark.count),
        small: t("screens.home.toMark", { count: toMark.count }),
        onPress: booking(toMark.bookingId, calendar),
      });
    if (cash && cash.count > 0)
      cards.push({
        key: "cash",
        icon: IconCash,
        big: money(cash.amount, cash.currency),
        small: t("screens.home.cash", { count: cash.count }),
        onPress: () => router.navigate("/venue/payments"),
      });
    if (weeks.count > 0)
      cards.push({
        key: "weeks",
        icon: IconRepeat,
        big: String(weeks.count),
        small: t("screens.home.weeks", { count: weeks.count }),
        onPress: booking(weeks.bookingId, () => push("/regulars")),
      });

    // Then the day at a glance, always there, so the row is never empty: its games, how full it
    // is, today's check-ins so far, and (seeing payments) what it comes to.
    const { games, booked, checkIns, takings } = home;
    cards.push({
      key: "games",
      icon: IconBallFootball,
      big: String(games.count),
      small:
        games.count === 0
          ? t(isToday ? "screens.home.gamesNoneToday" : "screens.home.gamesNone")
          : games.next
            ? t(isToday ? "screens.home.gamesNext" : "screens.home.gamesFirst", {
                count: games.count,
                time: sentenceTime(games.next, timezone, t),
              })
            : t("screens.home.gamesStarted", { count: games.count }),
      onPress: calendar,
    });
    cards.push({
      key: "booked",
      icon: IconCalendar,
      big: booked.open === 0 ? "–" : `${Math.round((booked.booked / booked.open) * 100)}%`,
      small:
        booked.open === 0
          ? t("screens.home.noHours")
          : t(isToday ? "screens.home.bookedToday" : "screens.home.bookedTomorrow"),
      onPress: calendar,
    });
    if (checkIns)
      cards.push({
        key: "checkIns",
        icon: IconCircleCheck,
        big:
          checkIns.started === 0
            ? "0"
            : t("screens.home.checkedInOf", {
                checkedIn: checkIns.checkedIn,
                started: checkIns.started,
              }),
        small: t("screens.home.checkedIn"),
        onPress: calendar,
      });
    if (takings)
      cards.push({
        key: "takings",
        icon: IconWallet,
        big: money(takings.amount, takings.currency),
        small: t(isToday ? "screens.home.takingsToday" : "screens.home.takingsTomorrow"),
        onPress: () => router.navigate("/venue/payments"),
      });
    return cards;
  }, [home, isToday, t]);
}

// A large grey card: its icon in a white disc, the count, what it counts.
function Card({ icon: CardIcon, big, small, onPress }: Omit<CardProps, "key">) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${big} ${small}`}
      onPress={onPress}
      className="h-[172px] w-[236px] justify-between rounded-[18px] bg-chip p-[18px] active:opacity-60"
    >
      <View className="size-[52px] items-center justify-center rounded-full bg-white">
        <CardIcon size={22} color={colors.ink} strokeWidth={1.75} />
      </View>
      <View>
        <Text className="text-[26px] font-semibold leading-8 tracking-[-0.3px]" numberOfLines={1}>
          {big}
        </Text>
        <Text className="mt-1 text-[15px] leading-5 text-ink-2" numberOfLines={1}>
          {small}
        </Text>
      </View>
    </Pressable>
  );
}

// Paused (user, 2026-11-27): a grey banner the full width of the screen above the title, with the
// status bar grey above it. It says players can't book, with Reopen (the Venue tab's Availability
// switch) and an × that hides it for that venue until the app is next opened. Scrolling carries it
// up under the status bar, which turns white as it goes; dismissing folds it shut, its words fading
// and the header easing up into place, while the status bar fades back to white.
const dismissedPauses = new Set<string>();

function PausedBanner({
  up,
  whiten,
  onHeight,
  onDismissed,
}: {
  // How far scrolling has carried it up (0 to -lift), on the native driver.
  up: Animated.AnimatedInterpolation<number>;
  // 0 to 1 over the same scroll: the banner and the status bar fading to white.
  whiten: Animated.AnimatedInterpolation<number>;
  onHeight: (height: number) => void;
  onDismissed: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const open = useRef(new Animated.Value(1)).current;
  const [height, setHeight] = useState(0);

  const dismiss = () => {
    Animated.timing(open, {
      toValue: 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onDismissed();
    });
  };

  return (
    <>
      <Animated.View
        style={{ marginHorizontal: -20, transform: [{ translateY: up }] }}
        className="bg-chip"
      >
        <Animated.View
          style={
            height === 0
              ? undefined
              : {
                  overflow: "hidden",
                  height: Animated.multiply(open, height),
                  opacity: open,
                }
          }
        >
          <View
            className="flex-row items-center pt-1.5 pb-2 ps-5 pe-3"
            onLayout={(event) => {
              if (height !== 0) return;
              setHeight(event.nativeEvent.layout.height);
              onHeight(event.nativeEvent.layout.height);
            }}
          >
            <IconPlayerPause size={20} color={colors.ink} strokeWidth={1.75} />
            <Text className="ms-3 flex-1 text-label text-ink-2">
              <Text className="text-label font-medium text-ink">{`${t("screens.home.paused")} · `}</Text>
              {`${t("screens.home.pausedBody")} `}
              {/* The space stays outside, so only the word is underlined; no grey flash on tap. */}
              <Text
                accessibilityRole="link"
                suppressHighlighting
                className="text-label font-medium text-ink underline"
                onPress={() => router.navigate("/venue/manage")}
              >
                {t("screens.home.reopen")}
              </Text>
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("components.shared.nav.close")}
              hitSlop={8}
              onPress={dismiss}
              className="ms-2 size-8 items-center justify-center active:opacity-60"
            >
              <IconX size={18} color={colors.ink} strokeWidth={1.75} />
            </Pressable>
          </View>
        </Animated.View>
        {/* White over it as it scrolls, so a banner the page can't scroll all the way off is gone
            all the same. Touches pass through to the × and Reopen. */}
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 bg-white"
          style={{ opacity: whiten }}
        />
      </Animated.View>

      {/* The status bar, grey over the banner, whitening as it scrolls under or folds away. Drawn
          after the banner, so the banner passes beneath it. */}
      <View
        pointerEvents="none"
        className="absolute bg-chip"
        style={{ top: -insets.top, height: insets.top, left: -20, right: -20 }}
      >
        <Animated.View
          className="absolute inset-0 bg-white"
          style={{
            opacity: whiten,
          }}
        />
        <Animated.View
          className="absolute inset-0 bg-white"
          style={{
            opacity: open.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          }}
        />
      </View>
    </>
  );
}

function Heading({ title, link, onLink }: { title: string; link?: string; onLink?: () => void }) {
  return (
    <View className="mt-8 mb-1 flex-row items-baseline">
      <Text accessibilityRole="header" className="flex-1 text-[22px] font-semibold leading-7">
        {title}
      </Text>
      {link ? (
        <Pressable accessibilityRole="link" onPress={onLink} hitSlop={8}>
          <Text className="text-[15px] font-medium underline">{link}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// The hour in a grey disc (am or pm under it), two lines beside it, the amount at the end and an action under it.
function TimeRow({
  at,
  timezone,
  title,
  line,
  amount,
  action,
  onAction,
  onPress,
}: {
  // When it starts: the hour in the disc, am or pm small under it.
  at: string;
  timezone: string;
  title: string;
  line: string;
  amount: string;
  action?: string;
  onAction?: () => void;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const start = clockOf(at, timezone);
  return (
    <Pressable onPress={onPress} className="mt-3 flex-row items-center py-1 active:opacity-60">
      <View className="size-[52px] items-center justify-center rounded-full bg-chip">
        <Text className="text-[14px] leading-[14px] font-semibold">{start.time}</Text>
        <Text className="text-[11px] leading-[12px] text-ink-2">
          {t(start.pm ? "screens.calendar.pm" : "screens.calendar.am")}
        </Text>
      </View>
      <View className="ms-3.5 flex-1">
        <Text className="text-subtitle font-medium" numberOfLines={1}>
          {title}
        </Text>
        <Text className="mt-0.5 text-label text-ink-2" numberOfLines={1}>
          {line}
        </Text>
      </View>
      <View className="ms-3 items-end">
        <Text className="text-subtitle font-medium">{amount}</Text>
        {action ? (
          <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
            <Text className="mt-0.5 text-label font-medium underline">{action}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

// "Pitch 1 · until 11 pm · cash" today; "Pitch 2 · 4 – 6 pm · paid in the app" on a later day.
const gameLine = (game: Game, isToday: boolean, timezone: string, t: TFunction) =>
  [
    game.ground.name ?? "",
    isToday
      ? t("screens.home.until", { time: sentenceTime(game.endsAt, timezone, t) })
      : hoursSpan(game.startsAt, game.endsAt, timezone, t),
    game.hold
      ? t("screens.home.held")
      : game.paymentMode === "PLATFORM"
        ? t("screens.home.inApp")
        : game.paymentMode === "DEPOSIT"
          ? t("screens.home.deposit")
          : t("screens.home.atVenue"),
  ].join(" · ");

function GameRow({
  game,
  isToday,
  now,
  timezone,
}: {
  game: Game;
  isToday: boolean;
  now: number;
  timezone: string;
}) {
  const { t } = useTranslation();
  const open = () => push(`/booking/${game.id}`);
  // An app booking about to start, nobody checked in yet: Check in opens the booking, where the
  // check-in is.
  const checkIn =
    isToday &&
    game.source === "APP" &&
    !game.hold &&
    !game.checkedIn &&
    Date.parse(game.startsAt) - now <= CHECK_IN_AHEAD &&
    Date.parse(game.endsAt) > now;
  return (
    <TimeRow
      at={game.startsAt}
      timezone={timezone}
      title={
        game.regular
          ? t("screens.home.regular", { name: game.customer.name.split(" ")[0] })
          : game.customer.name
      }
      line={gameLine(game, isToday, timezone, t)}
      amount={money(game.total, game.currency)}
      action={checkIn ? t("screens.home.checkIn") : undefined}
      onAction={open}
      onPress={open}
    />
  );
}

// The chips at once; the cards and rows as grey shapes in their places until the first answer.
function Loading() {
  return (
    <View>
      <View className="mt-4 flex-row gap-3">
        {[0, 1].map((key) => (
          <Bone key={key} className="h-[172px] w-[236px] rounded-[18px]" />
        ))}
      </View>
      <Bone className="mt-9 h-[22px] w-[110px] rounded-md" />
      {[0, 1, 2].map((key) => (
        <View key={key} className="mt-4 flex-row items-center">
          <Bone className="size-[52px] rounded-full" />
          <View className="ms-3.5 flex-1 gap-2.5">
            <Bone className="h-3.5 w-[150px] rounded" />
            <Bone className="h-3 w-[200px] rounded" />
          </View>
        </View>
      ))}
    </View>
  );
}
