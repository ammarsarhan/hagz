import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bone } from "@/components/bone";
import {
  NextGameTicket,
  PlayAgainCard,
  RAIL_WIDTH,
  Rail,
  RailGameCard,
  RailSkeleton,
  RailVenueCard,
  SavedCard,
  whenDay,
} from "@/components/home-rails";
import { useHudAnchor } from "@/components/hud";
import { IconBell, IconMapPin, IconSearch } from "@/components/icons";
import { RoundButton } from "@/components/nav";
import { FittedFailure } from "@/components/page-state";
import { usePullToRefresh } from "@/components/pull-to-refresh";
import { Text } from "@/components/text";
import { colors } from "@/lib/colors";
import { useHere } from "@/lib/distance";
import {
  BUDGET,
  TONIGHT_FROM,
  useGameRail,
  useNextGame,
  useVenueRail,
  useHomeGovernorate,
  type NextGame,
} from "@/lib/home";
import { isRTL } from "@/lib/language";
import { formatPrice } from "@/lib/money";
import { push } from "@/lib/navigation";
import { hourLabel, localDate, useCoverageState, type VenueCard } from "@/lib/search";
import { timeOfDay, timeRange } from "@/lib/venue";

// Home (Figma C12: 311:2 signed in, 312:2 guest, 313:2 the whole scroll): where the rails look
// (the area the phone is in, or one picked) with search beside it; "Evening, Omar" and the next game
// as the black ticket for a signed-in player, "Find a game tonight" for a guest; then the rails.
// The rails, in the Figma's order: Play again, Free tonight, Games needing players, Just freed, Saved
// venues, Most booked this week, Top rated, Instant confirmation, Within budget, New on Hagz. A rail
// with nothing in it isn't shown; the first three public ones stand as skeletons while they load.

// The tab bar's row (components/tab-bar.tsx), which the HUD sits on.
const TAB_ROW = 49;
// The bar the tab's name rises into, under the status bar, and how it comes in (the venue page's).
const BAR = 56;
const FADE = 24;
const RISE = 6;
const TONIGHT_HOUR = Number(TONIGHT_FROM.slice(0, 2));

// "Morning", "Afternoon" or "Evening", by the phone's clock.
const partOfDay = () => {
  const hour = new Date().getHours();
  return hour < 5 || hour >= 17 ? "evening" : hour < 12 ? "morning" : "afternoon";
};

export default function Home() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  useHudAnchor(TAB_ROW + insets.bottom);

  // Where: a governorate (lib/home.ts, useHomeGovernorate); Search narrows further.
  const phone = useHere();
  const { coverage, error: coverageError, retry: retryCoverage } = useCoverageState();
  const governorate = useHomeGovernorate(phone, coverage);
  const ready = governorate !== null;
  const base = governorate ? { area: governorate.id } : {};

  const { next, name, played, saved, read } = useNextGame();
  useFocusEffect(
    useCallback(() => {
      void read();
    }, [read]),
  );

  // Pull to refresh reads every rail and the next game again.
  const [generation, setGeneration] = useState(0);
  const tonight = useVenueRail({ ...base, after: TONIGHT_FROM }, ready, generation);
  const games = useGameRail(base, ready, generation);
  const topRated = useVenueRail({ ...base, sort: "RATING" }, ready, generation);
  const instant = useVenueRail({ ...base, instant: "true" }, ready, generation);
  const budget = useVenueRail({ ...base, priceMax: BUDGET }, ready, generation);
  const freed = useVenueRail({ ...base, justFreed: "true" }, ready, generation);
  const popular = useVenueRail({ ...base, sort: "POPULAR" }, ready, generation);
  const newest = useVenueRail({ ...base, sort: "NEWEST" }, ready, generation);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  // Everything scrolls, the where row too. Once the page is under the status bar, a white strip
  // fades in behind it over the first few points (as ScrollPage does); once the big title has gone
  // under, the strip grows into a bar and "Home" rises into it, as the venue page's name does
  // (user, 2026-11-24).
  const top = insets.top + 12;
  const bar = insets.top + BAR;
  // Where the big title ends, on the UI thread.
  const titleEnd = useSharedValue(Number.POSITIVE_INFINITY);
  const stripStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 12], [0, 1], "clamp"),
  }));
  const barProgress = useDerivedValue(() => {
    const gone = titleEnd.value - bar;
    return interpolate(scrollY.value, [gone - FADE, gone], [0, 1], "clamp");
  });
  const barStyle = useAnimatedStyle(() => ({ opacity: barProgress.value }));
  // The strip's hairline gives way to the bar's.
  const stripLine = useAnimatedStyle(() => ({ opacity: 1 - barProgress.value }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: barProgress.value,
    transform: [{ translateY: (1 - barProgress.value) * RISE }],
  }));

  const rails = [tonight, games, topRated, instant, budget, freed, popular, newest];
  const busy = rails.some((rail) => rail.loading);
  // Couldn't load (user, 2026-11-24): no governorates to pick from (so nowhere to look), or every
  // rail failed with nothing to show. Unplugged under the header, fitted, and nothing scrolls.
  const nowhere = governorate === null && coverageError !== null;
  const railsFailed =
    ready && rails.every((rail) => !rail.loading && rail.error !== null && rail.items.length === 0);
  const failure = nowhere ? coverageError : railsFailed ? rails[0]?.error : null;
  const tryAgain = () => {
    if (nowhere) retryCoverage();
    setGeneration((n) => n + 1);
    void read();
  };
  // Skeletons until a rail's first answer; a refresh keeps the rails already there.
  const waiting = (rail: { loading: boolean; items: unknown[] }) =>
    rail.loading && rail.items.length === 0;
  const pull = usePullToRefresh({
    scrollY,
    busy: busy && generation > 0,
    onRefresh: () => {
      setGeneration((n) => n + 1);
      void read();
    },
  });

  // See all: Search, looking where Home looks, with the rail's own choices.
  const seeAll = (preset: Record<string, string>) =>
    router.navigate({
      pathname: "/search",
      params: {
        at: String(Date.now()),
        ...(governorate ? { area: governorate.id, areaName: governorate.name ?? "" } : {}),
        ...preset,
      },
    });

  const inLine = governorate?.name
    ? t("screens.home.inPlace", { place: governorate.name })
    : t("screens.home.nearYou");
  const todayInCairo = localDate(tonight.timezone);
  const tonightIsTomorrow = tonight.date !== null && tonight.date !== todayInCairo;
  const fromHour = tonightIsTomorrow
    ? TONIGHT_HOUR
    : Math.max(TONIGHT_HOUR, new Date().getHours() + 1);

  const venueRail = (
    rail: ReturnType<typeof useVenueRail>,
    options: { wide?: boolean; badge?: (card: VenueCard, index: number) => string | null },
  ) => ({
    items: rail.items,
    keyOf: (card: VenueCard) => card.id,
    width: options.wide ? RAIL_WIDTH.wide : RAIL_WIDTH.narrow,
    render: (card: VenueCard) => (
      <RailVenueCard
        card={card}
        currency={rail.currency}
        timezone={rail.timezone}
        wide={options.wide}
        badge={options.badge?.(card, rail.items.indexOf(card)) ?? null}
      />
    ),
  });

  return (
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <StatusBar style="dark" />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={pull.control}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!failure}
        // Grows to the screen, so the failed scene can take what's left of it.
        contentContainerStyle={{ flexGrow: 1, paddingTop: top, paddingBottom: 32 }}
      >
        {/* Where the rails look (a governorate; picking one comes later), then search and
            notifications. */}
        <View className="flex-row items-center justify-between px-6">
          <View className="shrink flex-row items-center gap-1.5">
            <IconMapPin size={18} color={colors.ink} strokeWidth={1.75} />
            {governorate ? (
              <Text className="shrink text-body font-medium" numberOfLines={1}>
                {governorate.name}
              </Text>
            ) : nowhere ? null : (
              <Bone className="h-4 w-28 rounded-md" />
            )}
          </View>
          <View className="flex-row gap-2">
            <RoundButton
              icon={IconSearch}
              label={t("screens.home.search")}
              onPress={() => router.navigate("/search")}
            />
            <RoundButton
              icon={IconBell}
              label={t("screens.home.notifications")}
              onPress={() => push("/notifications")}
            />
          </View>
        </View>

        {name || next !== undefined ? (
          <Text
            accessibilityRole="header"
            className="px-6 pt-5 text-title font-semibold tracking-[-0.4px]"
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              titleEnd.value = y + height;
            }}
          >
            {name
              ? t(`screens.home.greeting.${partOfDay()}`, { name })
              : t("screens.home.guestTitle")}
          </Text>
        ) : (
          // The title's line, until it's known whether there's a player to greet.
          <View className="px-6 pt-5" style={{ height: 34 + 20 }}>
            <Bone className="mt-1 h-7 w-52 rounded-lg" />
          </View>
        )}

        {next ? (
          <View className="px-6 pt-5">
            <Ticket next={next} />
          </View>
        ) : null}

        {failure ? <FittedFailure error={failure} onRetry={tryAgain} /> : null}

        {/* The rails. Right under the title (no ticket: a guest, or nothing coming up) the first
            sits a little closer, as the ticket would. */}
        <View className={failure ? "hidden" : next ? "" : "-mt-3"}>
          {played.length > 0 ? (
            <Rail
              title={t("screens.home.playAgain")}
              items={played}
              keyOf={(entry) => entry.venue.id}
              width={RAIL_WIDTH.again}
              render={(entry) => <PlayAgainCard entry={entry} />}
            />
          ) : null}

          {waiting(tonight) ? <RailSkeleton kind="wide" /> : null}
          {tonight.items.length > 0 ? (
            <Rail
              title={
                tonightIsTomorrow ? t("screens.home.tomorrowNight") : t("screens.home.tonight")
              }
              line={t("screens.home.fromHour", { place: inLine, time: hourLabel(fromHour) })}
              onSeeAll={() => seeAll(tonight.date ? { date: tonight.date } : {})}
              {...venueRail(tonight, { wide: true })}
            />
          ) : null}

          {waiting(games) ? <RailSkeleton kind="game" /> : null}
          {games.items.length > 0 ? (
            <Rail
              title={t("screens.home.games")}
              onSeeAll={() => router.navigate("/community")}
              items={games.items}
              keyOf={(game) => game.id}
              width={RAIL_WIDTH.game}
              render={(game) => <RailGameCard game={game} />}
            />
          ) : null}

          {freed.items.length > 0 ? (
            <Rail
              title={t("screens.home.justFreed")}
              line={t("screens.home.justFreedLine")}
              {...venueRail(freed, { wide: true })}
            />
          ) : null}

          {saved.length > 0 ? (
            <Rail
              title={t("screens.home.saved")}
              onSeeAll={() => push("/favorites")}
              items={saved}
              keyOf={(venue) => venue.id}
              width={RAIL_WIDTH.narrow}
              render={(venue) => <SavedCard venue={venue} />}
            />
          ) : null}

          {popular.items.length > 0 ? (
            <Rail
              title={t("screens.home.popular")}
              onSeeAll={() => seeAll({ sort: "POPULAR" })}
              {...venueRail(popular, { badge: (_, index) => `#${index + 1}` })}
            />
          ) : null}

          {waiting(topRated) ? <RailSkeleton kind="narrow" /> : null}
          {topRated.items.length > 0 ? (
            <Rail
              title={t("screens.home.topRated")}
              onSeeAll={() => seeAll({ sort: "RATING" })}
              {...venueRail(topRated, {})}
            />
          ) : null}

          {instant.items.length > 0 ? (
            <Rail
              title={t("screens.home.instant")}
              line={t("screens.home.instantLine")}
              onSeeAll={() => seeAll({ instant: "true" })}
              {...venueRail(instant, { badge: () => t("screens.home.instantBadge") })}
            />
          ) : null}

          {budget.items.length > 0 ? (
            <Rail
              title={t("screens.home.budget")}
              line={t("screens.home.budgetLine", { price: formatPrice(BUDGET, budget.currency) })}
              onSeeAll={() => seeAll({ priceMax: String(BUDGET) })}
              {...venueRail(budget, {})}
            />
          ) : null}

          {newest.items.length > 0 ? (
            <Rail
              title={t("screens.home.newest")}
              onSeeAll={() => seeAll({ sort: "NEWEST" })}
              {...venueRail(newest, { badge: () => t("screens.home.newBadge") })}
            />
          ) : null}
        </View>
      </Animated.ScrollView>

      {pull.spinner}

      {/* Behind the status bar once the page scrolls under it, */}
      <Animated.View
        pointerEvents="none"
        className="absolute top-0 right-0 left-0 bg-white"
        style={[{ height: insets.top }, stripStyle]}
      >
        <Animated.View
          className="absolute right-0 bottom-0 left-0 border-b border-hairline"
          style={stripLine}
        />
      </Animated.View>
      {/* then a bar with the tab's name once the big title has gone under it. */}
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="absolute top-0 right-0 left-0 border-b border-hairline bg-white"
        style={[{ height: bar }, barStyle]}
      >
        <View className="justify-center px-6" style={{ marginTop: insets.top, height: BAR }}>
          <Animated.View style={compactStyle}>
            <Text className="text-body leading-[1.25] font-semibold" numberOfLines={1}>
              {t("components.tabs.home")}
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

// The next game as the black ticket: opens the booking or the game; My code once it's confirmed.
function Ticket({ next }: { next: NextGame }) {
  const { t } = useTranslation();
  const place = next.kind === "booking" ? next.booking : next.game;
  const timezone = next.kind === "booking" ? next.booking.venue.timezone : next.game.timezone;
  const checkIn = next.kind === "booking" ? next.booking.checkIn : next.game.me?.checkIn;
  const venue = [place.venue.name, place.venue.area?.split(",")[0]?.trim()]
    .filter(Boolean)
    .join(", ");
  const ground = place.ground.name;
  return (
    <NextGameTicket
      day={whenDay(place.startsAt, timezone)}
      range={timeRange(place.startsAt, place.endsAt, timezone)}
      place={[ground, venue].filter(Boolean).join(" · ")}
      checkInFrom={checkIn && !checkIn.checkedInAt ? timeOfDay(checkIn.opensAt, timezone) : null}
      onOpen={() =>
        next.kind === "booking"
          ? push({ pathname: "/bookings/[id]", params: { id: next.booking.id } })
          : push({ pathname: "/game/[id]", params: { id: next.game.id } })
      }
      onCode={
        checkIn && !checkIn.checkedInAt
          ? () =>
              next.kind === "booking"
                ? push({ pathname: "/bookings/[id]/check-in", params: { id: next.booking.id } })
                : push({ pathname: "/game/[id]/check-in", params: { id: next.game.id } })
          : null
      }
    />
  );
}
