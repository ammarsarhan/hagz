import type { components } from "@hagz/api";
import { useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { EmptyBenchArt } from "@/components/empty-bench-art";
import { FilterChip } from "@/components/filter-chip";
import {
  appliedGameFilters,
  type GameFilters,
  GameFiltersSheet,
  gameQuery,
  NO_GAME_FILTERS,
} from "@/components/game-filters";
import { useHudAnchor } from "@/components/hud";
import { IconAdjustmentsHorizontal, IconChevronRight } from "@/components/icons";
import { LightsOutArt } from "@/components/lights-out-art";
import { NoNameArt } from "@/components/no-name-art";
import { FailedMessage } from "@/components/page-state";
import { usePullToRefresh } from "@/components/pull-to-refresh";
import { Segment } from "@/components/segment";
import { SPORT_ICONS } from "@/components/sport-icons";
import { SpotsRow } from "@/components/spots-row";
import { Text } from "@/components/text";
import i18n from "@/i18next/i18next";
import { api, auth } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { useHere } from "@/lib/distance";
import { isRTL } from "@/lib/language";
import { push } from "@/lib/navigation";
import { sizeName, sportName } from "@/lib/search";
import { formatPrice } from "@/lib/money";
import {
  clockParts,
  dayLabel,
  daysUntil,
  hourAt,
  kindOf,
  localDateOf,
  timeOfDay,
} from "@/lib/venue";

// Community (Figma C11b, option A "Agenda", 290:2; user, 2026-11-23): Discover | Mine. Discover is
// the open games near the player, by day (Tonight, Tomorrow, Sat 28 Nov), each a row with its time
// big on the left, what and where, and the spots row with how many are left. Filters as on Search:
// the sport chips, and a sheet for the day, time, distance, price, ground and spots (game-filters). Mine is the games they've joined. Tournaments come later (Phase 4b).

type Game = components["schemas"]["Game"];
type Sport = components["schemas"]["GroundSport"];
type Size = components["schemas"]["GroundSize"];
type Tab = "discover" | "mine";

const TAB_ROW = 49;
const SEGMENT = 44;
const TITLE_TO_SEGMENT = 16;
const SPORTS: Sport[] = ["FOOTBALL", "PADEL", "TENNIS", "BASKETBALL", "VOLLEYBALL"];
const SIZES: Size[] = ["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"];
// From this hour on, today reads "Tonight".
const EVENING = 17;

type Item =
  | { kind: "day"; key: string; label: string }
  | { kind: "game"; game: Game; last: boolean }
  // Joined (Figma 288:2): "Coming up" and "Played" over a card for each game to come and a row for
  // each played.
  | { kind: "caption"; key: string; label: string }
  | { kind: "card"; game: Game }
  | { kind: "played"; game: Game; last: boolean };

export default function CommunityTab() {
  const insets = useSafeAreaInsets();
  useHudAnchor(TAB_ROW + insets.bottom);
  const [tab, setTab] = useState<Tab>("discover");
  // Undefined while checking; false for a guest (Mine asks them to sign in).
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
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
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <StatusBar style="dark" />
      {/* One list for both tabs, so the switcher stays put and slides as it's tapped. */}
      <Games tab={tab} onTab={setTab} signedIn={signedIn} />
    </View>
  );
}

function Games({
  tab,
  onTab,
  signedIn,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  signedIn: boolean | undefined;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const here = useHere();
  const [filters, setFilters] = useState<GameFilters>(NO_GAME_FILTERS);
  const [games, setGames] = useState<Game[] | null>(null);
  // Joined: the games played, under the ones to come.
  const [played, setPlayed] = useState<Game[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [editing, setEditing] = useState(false);
  // Answers to an older ask (filters changed since) are dropped.
  const asked = useRef(0);
  const discover = tab === "discover";
  const near = here && filters.radius !== null ? here : null;
  // Discover waits for the phone to say where it is (or that it can't); Mine, for whether they're
  // signed in, and a guest's Mine asks for nothing.
  const guest = !discover && signedIn === false;
  const ready = discover ? here !== undefined : signedIn === true;

  // Another tab: what the last one showed goes, and its answers too.
  const [shownTab, setShownTab] = useState(tab);
  if (shownTab !== tab) {
    setShownTab(tab);
    asked.current++;
    setLoading(false);
    setMore(false);
    setGames(null);
    setPlayed([]);
    setCursor(null);
    setFailure(null);
  }

  const load = useCallback(
    async (after: string | null) => {
      const ask = ++asked.current;
      if (after) setMore(true);
      else setLoading(true);
      // Joined reads the games played alongside the ones to come.
      const past =
        discover || after
          ? null
          : send(api.GET("/v1/games/mine", { params: { query: { when: "past" } } }));
      const result = discover
        ? await send(
            api.GET("/v1/games", {
              params: {
                query: {
                  ...(near && filters.radius !== null
                    ? {
                        latitude: near.latitude,
                        longitude: near.longitude,
                        radius: filters.radius,
                      }
                    : {}),
                  ...gameQuery(filters),
                  ...(after ? { cursor: after } : {}),
                },
              },
            }),
          )
        : await send(api.GET("/v1/games/mine", { params: { query: { when: "upcoming" } } }));
      const pastResult = past ? await past : null;
      if (ask !== asked.current) return;
      if (pastResult?.ok) setPlayed(pastResult.data.data);
      setLoading(false);
      setMore(false);
      if (!result.ok) {
        if (!after) setFailure(result.error);
        return;
      }
      setFailure(null);
      setGames((now) => (after ? [...(now ?? []), ...result.data.data] : result.data.data));
      const page = result.data as { nextCursor?: string | null };
      setCursor(page.nextCursor ?? null);
    },
    [discover, near?.latitude, near?.longitude, filters],
  );

  useEffect(() => {
    if (ready) void load(null);
  }, [ready, load]);

  // Back on the tab (from a game joined or left): read again, quietly.
  const shown = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (shown.current && ready) void load(null);
      shown.current = true;
    }, [ready, load]),
  );

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const pull = usePullToRefresh({ scrollY, busy: loading, onRefresh: () => void load(null) });

  const items = games
    ? discover
      ? itemsOf(games)
      : joinedItems(games, played, t("screens.community.comingUp"), t("screens.community.played"))
    : [];
  // The chips row, Search's: Filters with how many are on, the sport (the others hidden once one is
  // picked; tap it again for all), its sizes, then what's applied, each with an ×.
  const applied = appliedGameFilters(filters, Boolean(here));
  const onChip = useCallback((id: string) => {
    if (id === "filters") setEditing(true);
    else if (id.startsWith("sport:")) {
      const picked = id.slice(6) as Sport;
      setFilters((now) =>
        now.sport === picked
          ? { ...now, sport: undefined, size: undefined }
          : { ...now, sport: picked, size: undefined },
      );
    } else if (id.startsWith("size:")) {
      const picked = id.slice(5) as Size;
      setFilters((now) => ({ ...now, size: now.size === picked ? undefined : picked }));
    } else {
      setFilters((now) => {
        const chip = appliedGameFilters(now, true).find((each) => each.key === id);
        return chip ? chip.without(now) : now;
      });
    }
  }, []);

  // The Search and Bookings header: the title scrolls away; the switcher floats over its slot,
  // following the page up until it docks just under the status bar, a white header fading in
  // behind it.
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

  const header = (
    <View>
      <Text accessibilityRole="header" className="px-6 text-title font-semibold tracking-[-0.4px]">
        {t("screens.community.title")}
      </Text>
      {/* The switcher's slot: it floats over it (below), so it can dock. */}
      <View
        style={{ height: SEGMENT, marginTop: TITLE_TO_SEGMENT }}
        onLayout={(event) => {
          segmentStart.value = top + event.nativeEvent.layout.y;
        }}
      />
      {discover ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3.5"
          contentContainerClassName="gap-2 px-6"
        >
          <FilterChip
            id="filters"
            label={
              applied.length > 0
                ? t("screens.search.filtersCount", { count: applied.length })
                : t("screens.community.filters")
            }
            on={false}
            icon={<IconAdjustmentsHorizontal size={16} color={colors.ink} strokeWidth={2} />}
            onSelect={onChip}
          />
          {(filters.sport ? [filters.sport] : SPORTS).map((each) => (
            <FilterChip
              key={each}
              id={`sport:${each}`}
              label={sportName(each)}
              ball={SPORT_ICONS[each]}
              on={filters.sport === each}
              onSelect={onChip}
            />
          ))}
          {filters.sport === "FOOTBALL"
            ? SIZES.map((size) => (
                <FilterChip
                  key={size}
                  id={`size:${size}`}
                  label={sizeName(size)}
                  on={filters.size === size}
                  onSelect={onChip}
                />
              ))
            : null}
          {applied.map((chip) => (
            <FilterChip
              key={chip.key}
              id={chip.key}
              label={chip.label}
              on={false}
              removable
              onSelect={onChip}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1">
      <Animated.FlatList
        data={items}
        keyExtractor={(item) =>
          item.kind === "day" || item.kind === "caption" ? item.key : `${item.kind}:${item.game.id}`
        }
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={pull.control}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: top, paddingBottom: 32, flexGrow: 1 }}
        ListHeaderComponent={header}
        renderItem={({ item }) =>
          item.kind === "day" ? (
            <Text
              accessibilityRole="header"
              className="px-6 pt-[18px] pb-0.5 text-body font-semibold"
            >
              {item.label}
            </Text>
          ) : item.kind === "caption" ? (
            <Text className="px-6 pt-[22px] pb-2.5 text-caption leading-[18px] text-unit">
              {item.label}
            </Text>
          ) : item.kind === "card" ? (
            <JoinedCard game={item.game} />
          ) : item.kind === "played" ? (
            <PlayedRow game={item.game} last={item.last} />
          ) : (
            <Row game={item.game} last={item.last} />
          )
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (discover && cursor && !more && !loading) void load(cursor);
        }}
        ListEmptyComponent={
          guest ? (
            <Guest />
          ) : games === null || (loading && games.length === 0) ? (
            failure ? (
              <View className="flex-1 items-center justify-center px-8 pb-10">
                <FailedMessage error={failure} />
                <View className="mt-6 self-stretch">
                  <Button
                    label={t("common.actions.tryAgain")}
                    variant="secondary"
                    onPress={() => void load(null)}
                  />
                </View>
              </View>
            ) : (
              <View className="flex-1 items-center justify-center pb-10">
                <ActivityIndicator color={colors.ink} />
              </View>
            )
          ) : (
            <Empty discover={discover} />
          )
        }
        ListFooterComponent={
          more ? (
            <View className="py-6">
              <ActivityIndicator color={colors.ink} />
            </View>
          ) : undefined
        }
      />
      {pull.spinner}

      {/* The header the switcher docks in: white, fading in as it arrives. */}
      <Animated.View
        pointerEvents="none"
        className="absolute top-0 right-0 left-0 border-b border-hairline bg-white"
        style={[{ height: dockAt + SEGMENT + 10 }, headerStyle]}
      />
      <Animated.View className="absolute top-0 right-6 left-6" style={segmentStyle}>
        <Segment
          options={[
            { key: "discover", label: t("screens.community.discover") },
            { key: "mine", label: t("screens.community.mine") },
          ]}
          value={tab}
          onChange={onTab}
        />
      </Animated.View>

      <GameFiltersSheet
        visible={editing}
        filters={filters}
        located={Boolean(here)}
        onApply={(next) => {
          setFilters(next);
          setEditing(false);
        }}
        onClose={() => setEditing(false)}
      />
    </View>
  );
}

// "Tonight" (from 5 pm, else "Today"), "Tomorrow", or "Sat 28 Nov", at the game's venue.
const dayHeading = (iso: string, timezone: string) => {
  const days = daysUntil(iso, timezone);
  if (days === 0)
    return hourAt(iso, timezone) >= EVENING
      ? i18n.t("screens.community.tonight")
      : i18n.t("screens.community.today");
  if (days === 1) return i18n.t("screens.community.tomorrow");
  return dayLabel(localDateOf(iso, timezone));
};

function itemsOf(games: Game[]): Item[] {
  const items: Item[] = [];
  let day = "";
  games.forEach((game, index) => {
    const date = localDateOf(game.startsAt, game.timezone);
    if (date !== day) {
      day = date;
      items.push({
        kind: "day",
        key: date,
        label: dayHeading(game.startsAt, game.timezone),
      });
    }
    const following = games[index + 1];
    const last = !following || localDateOf(following.startsAt, following.timezone) !== date;
    items.push({ kind: "game", game, last });
  });
  return items;
}

// Joined: "Coming up" over a card for each game to come, then "Played" over the rest.
function joinedItems(coming: Game[], played: Game[], comingUp: string, playedLabel: string) {
  const items: Item[] = [];
  if (coming.length > 0) {
    items.push({ kind: "caption", key: "coming", label: comingUp });
    coming.forEach((game) => items.push({ kind: "card", game }));
  }
  if (played.length > 0) {
    items.push({ kind: "caption", key: "played", label: playedLabel });
    played.forEach((game, index) =>
      items.push({ kind: "played", game, last: index === played.length - 1 }),
    );
  }
  return items;
}

// "Pitch 2 · 5-a-side · Nile Kickoff, Maadi": the size alone for football, else the sport.
const placeOf = (game: Game) => {
  const venue = [game.venue.name, game.venue.area?.split(",")[0]?.trim()]
    .filter(Boolean)
    .join(", ");
  const kind =
    game.ground.sport === "FOOTBALL" ? sizeName(game.ground.size) : sportName(game.ground.sport);
  return [game.ground.name, kind, venue].filter(Boolean).join(" · ");
};

// A game to come (Figma 288:2): when, where, who's in, and what's paid at the venue.
function JoinedCard({ game }: { game: Game }) {
  const { t } = useTranslation();
  const { timezone } = game;
  const checkedIn = game.me?.checkIn?.checkedInAt;
  const standing =
    game.status === "CANCELLED"
      ? t("screens.bookings.game.calledOff")
      : checkedIn
        ? t("screens.booking.checkedIn.title")
        : t("screens.community.youreIn");
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => push({ pathname: "/game/[id]", params: { id: game.id } })}
      className="mx-6 mb-3 rounded-[20px] border border-border bg-white p-[19px] active:opacity-80"
    >
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1 gap-0.5">
          <Text className="text-[20px] leading-[26px] font-semibold">
            {t("formats.moment", {
              day: dayHeading(game.startsAt, timezone),
              time: timeOfDay(game.startsAt, timezone),
            })}
          </Text>
          <Text className="text-label leading-5 text-ink-2" numberOfLines={1}>
            {placeOf(game)}
          </Text>
        </View>
        {game.distanceKm === null ? null : (
          <Text className="text-caption leading-[18px] text-unit">
            {t("screens.community.km", {
              km: game.distanceKm < 10 ? game.distanceKm.toFixed(1) : Math.round(game.distanceKm),
            })}
          </Text>
        )}
      </View>
      <View className="mt-3.5">
        <SpotsRow
          booker={game.booker.firstName}
          joined={game.playerCount}
          names={game.players?.map((player) => player.firstName) ?? null}
          open={game.spotsLeft}
          size={30}
        />
      </View>
      <View className="mt-3.5 flex-row items-center justify-between gap-3">
        <Text className="text-subtitle leading-[22px] font-medium">{standing}</Text>
        {game.status === "CANCELLED" ? null : (
          <Text className="shrink text-right text-label leading-5 text-unit">
            <Text className="text-label leading-5 font-medium">
              {formatPrice(game.sharePrice, game.currency)}
            </Text>
            {` ${t("screens.community.plusFee", { fee: formatPrice(game.joinFee, game.currency) })}`}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// A game played: the venue, when, and whose game it was (and whether they checked in).
function PlayedRow({ game, last }: { game: Game; last: boolean }) {
  const { t } = useTranslation();
  const { timezone } = game;
  const how =
    game.status === "CANCELLED"
      ? t("screens.community.calledOff")
      : game.me?.checkIn?.checkedInAt
        ? t("screens.community.checkedIn")
        : null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => push({ pathname: "/game/[id]", params: { id: game.id } })}
      className="mx-6 active:opacity-70"
    >
      <View
        className={`flex-row items-center gap-4 py-3.5 ${last ? "" : "border-b border-border"}`}
      >
        <View className="flex-1">
          <Text className="text-subtitle leading-5 font-medium" numberOfLines={1}>
            {game.venue.name ?? t("screens.venue.fallbackName")}
          </Text>
          <Text className="text-subtitle leading-5 font-medium">
            {t("formats.moment", {
              day: dayLabel(localDateOf(game.startsAt, timezone)),
              time: timeOfDay(game.startsAt, timezone),
            })}
          </Text>
          <Text className="pt-0.5 text-caption leading-[18px] text-ink-2">
            {[t("screens.community.gameOf", { name: game.booker.firstName }), how]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        <View style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}>
          <IconChevronRight size={18} color={colors.ink3} strokeWidth={1.75} />
        </View>
      </View>
    </Pressable>
  );
}

// A game in the agenda: its time big on the left, then what, where (and how far), and the spots.
function Row({ game, last }: { game: Game; last: boolean }) {
  const { t } = useTranslation();
  const { time, period } = clockParts(game.startsAt, game.timezone);
  const where = [game.venue.name, game.venue.area?.split(",")[0]?.trim()]
    .filter(Boolean)
    .join(", ");
  const distance =
    game.distanceKm === null
      ? null
      : t("screens.community.km", {
          km: game.distanceKm < 10 ? game.distanceKm.toFixed(1) : Math.round(game.distanceKm),
        });
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => push({ pathname: "/game/[id]", params: { id: game.id } })}
      className="mx-6 active:opacity-70"
    >
      <View className={`flex-row gap-3.5 py-3.5 ${last ? "" : "border-b border-border"}`}>
        <View className="w-[54px]">
          <Text className="text-[20px] leading-6 font-semibold">{time}</Text>
          <Text className="text-caption leading-[18px] text-unit">{period}</Text>
        </View>
        <View className="flex-1 gap-[3px]">
          <Text className="text-caption leading-[18px] font-medium text-unit">
            {game.me?.status === "JOINED"
              ? t("screens.community.youreIn")
              : t("screens.community.openGame")}
          </Text>
          <Text className="text-subtitle leading-[22px] font-medium" numberOfLines={1}>
            {kindOf(game.ground)}
          </Text>
          <Text className="text-label leading-5 text-ink-2" numberOfLines={1}>
            {[where, distance].filter(Boolean).join(" · ")}
          </Text>
          <View className="flex-row items-center justify-between pt-2">
            <SpotsRow
              booker={game.booker.firstName}
              joined={game.playerCount}
              names={game.players?.map((player) => player.firstName) ?? null}
              open={game.spotsLeft}
            />
            <Text className="text-caption leading-[18px] font-medium">
              {game.spotsLeft > 0
                ? t("screens.community.spotsLeft", { count: game.spotsLeft })
                : t("screens.community.full")}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// Nothing to show: Discover, the floodlight with its lamps off; Mine, the empty bench.
function Empty({ discover }: { discover: boolean }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center px-8 pb-10">
      {discover ? <LightsOutArt /> : <EmptyBenchArt />}
      <Text accessibilityRole="header" className="mt-3 text-heading font-semibold">
        {discover ? t("screens.community.emptyTitle") : t("screens.community.mineEmptyTitle")}
      </Text>
      <Text className="mt-2 text-center text-subtitle text-ink-2">
        {discover ? t("screens.community.emptyBody") : t("screens.community.mineEmptyBody")}
      </Text>
    </View>
  );
}

// Mine for a guest: the shirt with no name, and a way in.
function Guest() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center px-8 pb-6">
      <NoNameArt />
      <Text accessibilityRole="header" className="mt-3 text-heading font-semibold">
        {t("screens.account.guestTitle")}
      </Text>
      <Text className="mt-2 text-center text-subtitle text-ink-2">
        {t("screens.community.guest")}
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
