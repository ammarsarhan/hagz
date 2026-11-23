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
import { useHudAnchor } from "@/components/hud";
import { IconAdjustmentsHorizontal, IconCheck, IconMapPin } from "@/components/icons";
import { LightsOutArt } from "@/components/lights-out-art";
import { NoNameArt } from "@/components/no-name-art";
import { EmptyBenchArt } from "@/components/empty-bench-art";
import { FailedMessage } from "@/components/page-state";
import { usePullToRefresh } from "@/components/pull-to-refresh";
import { Segment } from "@/components/segment";
import { Sheet } from "@/components/sheet";
import { SpotsRow } from "@/components/spots-row";
import { Text } from "@/components/text";
import i18n from "@/i18next/i18next";
import { api, auth } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { useHere } from "@/lib/distance";
import { isRTL } from "@/lib/language";
import { push } from "@/lib/navigation";
import { localDate, sizeName, sportName } from "@/lib/search";
import { clockParts, dayLabel, daysUntil, hourAt, kindOf, localDateOf } from "@/lib/venue";

// Community (Figma C11b, option A "Agenda", 290:2; user, 2026-11-23): Discover | Mine. Discover is
// the open games near the player, by day (Tonight, Tomorrow, Sat 28 Nov), each a row with its time
// big on the left, what and where, and the spots row with how many are left. Near me, a day and
// the ground narrow it. Mine is the games they've joined. Tournaments come later (Phase 4b).

type Game = components["schemas"]["Game"];
type Sport = components["schemas"]["GroundSport"];
type Size = components["schemas"]["GroundSize"];
type Tab = "discover" | "mine";

const TAB_ROW = 49;
const SEGMENT = 44;
const TITLE_TO_SEGMENT = 16;
const RADIUS = 25;
const SPORTS: Sport[] = ["FOOTBALL", "PADEL", "TENNIS", "BASKETBALL", "VOLLEYBALL"];
const SIZES: Size[] = ["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"];
const TIMEZONE = "Africa/Cairo";
// From this hour on, today reads "Tonight".
const EVENING = 17;

interface Filters {
  near: boolean;
  date: string | null;
  sport?: Sport;
  size?: Size;
}

type Item =
  { kind: "day"; key: string; label: string } | { kind: "game"; game: Game; last: boolean };

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
  const [filters, setFilters] = useState<Filters>({ near: true, date: null });
  const [games, setGames] = useState<Game[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [sheet, setSheet] = useState<"day" | "filters" | null>(null);
  // Answers to an older ask (filters changed since) are dropped.
  const asked = useRef(0);
  const discover = tab === "discover";
  const near = filters.near && here ? here : null;
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
    setCursor(null);
    setFailure(null);
  }

  const load = useCallback(
    async (after: string | null) => {
      const ask = ++asked.current;
      if (after) setMore(true);
      else setLoading(true);
      const result = discover
        ? await send(
            api.GET("/v1/games", {
              params: {
                query: {
                  ...(near
                    ? { latitude: near.latitude, longitude: near.longitude, radius: RADIUS }
                    : {}),
                  ...(filters.date ? { date: filters.date } : {}),
                  ...(filters.sport ? { sport: filters.sport } : {}),
                  ...(filters.size ? { size: filters.size } : {}),
                  ...(after ? { cursor: after } : {}),
                },
              },
            }),
          )
        : await send(api.GET("/v1/games/mine", { params: { query: { when: "upcoming" } } }));
      if (ask !== asked.current) return;
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

  const items = games ? itemsOf(games) : [];
  const dayChip = filters.date ? dayName(filters.date) : t("screens.community.anyDay");
  const filtered = Boolean(filters.sport || filters.size);

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
          <Chip
            on={filtered}
            label={
              filters.sport
                ? filters.size
                  ? sizeName(filters.size)
                  : sportName(filters.sport)
                : t("screens.community.filters")
            }
            icon={IconAdjustmentsHorizontal}
            onPress={() => setSheet("filters")}
          />
          <Chip
            on={Boolean(near)}
            label={t("screens.community.nearMe")}
            icon={IconMapPin}
            onPress={() => setFilters((now) => ({ ...now, near: !now.near }))}
          />
          <Chip on={filters.date !== null} label={dayChip} onPress={() => setSheet("day")} />
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1">
      <Animated.FlatList
        data={items}
        keyExtractor={(item) => (item.kind === "day" ? item.key : item.game.id)}
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

      <DaySheet
        visible={sheet === "day"}
        date={filters.date}
        onPick={(date) => {
          setFilters((now) => ({ ...now, date }));
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <FiltersSheet
        visible={sheet === "filters"}
        sport={filters.sport}
        size={filters.size}
        onPick={(sport, size) => {
          setFilters((now) => ({ ...now, sport, size }));
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
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

// A date picked in the day sheet: "Today", "Tomorrow", or "Sat 28 Nov".
const dayName = (date: string) =>
  date === localDate(TIMEZONE)
    ? i18n.t("screens.community.today")
    : date === localDate(TIMEZONE, 1)
      ? i18n.t("screens.community.tomorrow")
      : dayLabel(date);

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
              names={game.players}
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

// A chip in the row under the switcher: black with white words when on.
function Chip({
  on,
  label,
  icon: Icon,
  onPress,
}: {
  on: boolean;
  label: string;
  icon?: typeof IconMapPin;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={`h-9 flex-row items-center gap-1.5 rounded-full border px-3.5 active:opacity-70 ${on ? "border-ink bg-ink" : "border-border bg-white"}`}
    >
      {Icon ? <Icon size={15} color={on ? colors.white : colors.ink} strokeWidth={2} /> : null}
      <Text className={`text-label font-medium ${on ? "text-white" : ""}`}>{label}</Text>
    </Pressable>
  );
}

// Any day, or one of the next seven.
function DaySheet({
  visible,
  date,
  onPick,
  onClose,
}: {
  visible: boolean;
  date: string | null;
  onPick: (date: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const days = Array.from({ length: 7 }, (_, i) => localDate(TIMEZONE, i));
  const options: { date: string | null; label: string }[] = [
    { date: null, label: t("screens.community.anyDay") },
    ...days.map((day) => ({ date: day, label: dayName(day) })),
  ];
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text className="mb-2 text-heading font-semibold">{t("screens.community.when")}</Text>
      {options.map((option) => (
        <Pressable
          key={option.date ?? "any"}
          accessibilityRole="button"
          accessibilityState={{ selected: option.date === date }}
          onPress={() => onPick(option.date)}
          className="h-12 flex-row items-center justify-between active:opacity-60"
        >
          <Text className="text-subtitle">{option.label}</Text>
          {option.date === date ? <IconCheck size={20} color={colors.ink} strokeWidth={2} /> : null}
        </Pressable>
      ))}
    </Sheet>
  );
}

// The ground: a sport, and for football its size.
function FiltersSheet({
  visible,
  sport,
  size,
  onPick,
  onClose,
}: {
  visible: boolean;
  sport?: Sport;
  size?: Size;
  onPick: (sport?: Sport, size?: Size) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<{ sport?: Sport; size?: Size }>({ sport, size });
  useEffect(() => {
    if (visible) setDraft({ sport, size });
  }, [visible, sport, size]);
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text className="mb-4 text-heading font-semibold">{t("screens.community.filters")}</Text>
      <Text className="mb-2.5 text-label font-medium text-ink-2">
        {t("screens.community.sport")}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Pill
          on={!draft.sport}
          label={t("screens.community.anySport")}
          onPress={() => setDraft({})}
        />
        {SPORTS.map((one) => (
          <Pill
            key={one}
            on={draft.sport === one}
            label={sportName(one)}
            onPress={() => setDraft({ sport: one })}
          />
        ))}
      </View>
      {draft.sport === "FOOTBALL" ? (
        <>
          <Text className="mt-5 mb-2.5 text-label font-medium text-ink-2">
            {t("screens.community.size")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Pill
              on={!draft.size}
              label={t("screens.community.anySize")}
              onPress={() => setDraft({ sport: "FOOTBALL" })}
            />
            {SIZES.map((one) => (
              <Pill
                key={one}
                on={draft.size === one}
                label={sizeName(one)}
                onPress={() => setDraft({ sport: "FOOTBALL", size: one })}
              />
            ))}
          </View>
        </>
      ) : null}
      <View className="mt-7">
        <Button
          label={t("screens.community.show")}
          onPress={() => onPick(draft.sport, draft.size)}
        />
      </View>
    </Sheet>
  );
}

function Pill({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={`h-10 justify-center rounded-full border px-4 active:opacity-70 ${on ? "border-ink bg-ink" : "border-border bg-white"}`}
    >
      <Text className={`text-body font-medium ${on ? "text-white" : ""}`}>{label}</Text>
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
