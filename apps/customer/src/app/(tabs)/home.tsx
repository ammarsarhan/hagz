import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
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
import { IconChevronDown, IconMapPin, IconSearch } from "@/components/icons";
import { RoundButton } from "@/components/nav";
import { usePullToRefresh } from "@/components/pull-to-refresh";
import { SearchWhere } from "@/components/search-where";
import { Text } from "@/components/text";
import { colors } from "@/lib/colors";
import { useHere } from "@/lib/distance";
import {
  BUDGET,
  DEFAULT_RADIUS_KM,
  TONIGHT_FROM,
  useAreaName,
  useGameRail,
  useNextGame,
  useVenueRail,
  whereQuery,
  type NextGame,
} from "@/lib/home";
import { isRTL } from "@/lib/language";
import { formatPrice } from "@/lib/money";
import { push } from "@/lib/navigation";
import { hourLabel, localDate, useCoverage, type VenueCard, type Where } from "@/lib/search";
import { timeOfDay, timeRange } from "@/lib/venue";

// Home (Figma C12: 311:2 signed in, 312:2 guest, 313:2 the whole scroll): where the rails look
// (the area the phone is in, or one picked) with search beside it; "Evening, Omar" and the next game
// as the black ticket for a signed-in player, "Find a game tonight" for a guest; then the rails.
// The rails, in the Figma's order: Play again, Free tonight, Games needing players, Just freed, Saved
// venues, Most booked this week, Top rated, Instant confirmation, Within budget, New on Hagz. A rail
// with nothing in it isn't shown; the first three public ones stand as skeletons while they load.

// The tab bar's row (components/tab-bar.tsx), which the HUD sits on.
const TAB_ROW = 49;
// The where row (the search button's height), which docks under the status bar like the other
// tabs' bar and switchers.
const WHERE_ROW = 40;
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

  // Where: near the player, or the governorate with the most venues without a position.
  const phone = useHere();
  const coverage = useCoverage();
  const [choice, setChoice] = useState<Where>({ kind: "near", radius: DEFAULT_RADIUS_KM });
  const fallback = coverage?.[0];
  const where: Where | null =
    choice.kind === "near" && phone === null
      ? fallback
        ? { kind: "area", id: fallback.id, name: fallback.name ?? "", within: null }
        : null
      : choice;
  const [picking, setPicking] = useState(false);
  const area = useAreaName(where, phone);
  const ready = phone !== undefined && where !== null;
  const base = whereQuery(where, phone ?? null);

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
  // The other tabs' header: the where row rides up with the page and docks just under the status
  // bar, a white header with its hairline fading in behind it; the greeting scrolls away.
  const top = insets.top + 12;
  const dockAt = insets.top + 6;
  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(dockAt, top - scrollY.value) }],
  }));
  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(top - scrollY.value, [dockAt + 24, dockAt], [0, 1], "clamp"),
  }));

  const busy = [tonight, games, topRated, instant, budget, freed, popular, newest].some(
    (rail) => rail.loading,
  );
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
        ...(where?.kind === "area" ? { area: where.id, areaName: where.name } : {}),
        ...preset,
      },
    });

  const nearLine = area?.name
    ? t("screens.home.near", { place: area.name })
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
        contentContainerStyle={{ paddingTop: top, paddingBottom: 32 }}
      >
        {/* The where row's slot: the row floats over it (below), so it can dock. */}
        <View style={{ height: WHERE_ROW }} />

        {name || next !== undefined ? (
          <Text
            accessibilityRole="header"
            className="px-6 pt-5 text-title font-semibold tracking-[-0.4px]"
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
            title={tonightIsTomorrow ? t("screens.home.tomorrowNight") : t("screens.home.tonight")}
            line={t("screens.home.fromHour", { place: nearLine, time: hourLabel(fromHour) })}
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
      </Animated.ScrollView>

      {pull.spinner}

      {/* The header the where row docks in, then the row: where the rails look, and search. */}
      <Animated.View
        pointerEvents="none"
        className="absolute top-0 right-0 left-0 border-b border-hairline bg-white"
        style={[{ height: dockAt + WHERE_ROW + 10 }, headerStyle]}
      />
      <Animated.View
        className="absolute top-0 right-6 left-6 flex-row items-center justify-between"
        style={[{ height: WHERE_ROW }, rowStyle]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("screens.home.changeWhere")}
          hitSlop={8}
          onPress={() => setPicking(true)}
          className="shrink flex-row items-center gap-1.5 active:opacity-60"
        >
          <IconMapPin size={18} color={colors.ink} strokeWidth={1.75} />
          {area ? (
            <Text className="shrink text-body font-medium" numberOfLines={1}>
              {[area.name, area.within].filter(Boolean).join(", ")}
            </Text>
          ) : (
            <Bone className="h-4 w-32 rounded-md" />
          )}
          <IconChevronDown size={16} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <RoundButton
          icon={IconSearch}
          label={t("screens.home.search")}
          onPress={() => router.navigate("/search")}
        />
      </Animated.View>

      {picking && where ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(150)}
          style={StyleSheet.absoluteFill}
        >
          <SearchWhere
            here={phone ?? null}
            where={where}
            params={{}}
            onPick={(next) => {
              setChoice(next);
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
            areasOnly
          />
        </Animated.View>
      ) : null}
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
