import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useDeferredValue, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  type DerivedValue,
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { FailedMessage } from "@/components/page-state";
import { usePullToRefresh } from "@/components/pull-to-refresh";
import { LightsOutArt } from "@/components/lights-out-art";
import { IconAdjustmentsHorizontal, IconArrowsSort, IconMap, IconSearch } from "@/components/icons";
import { VenueListCard } from "@/components/search-cards";
import { MapToggle, SearchMap } from "@/components/search-map";
import { SearchWhen } from "@/components/search-when";
import { Bone } from "@/components/bone";
import { FilterChip as Chip } from "@/components/filter-chip";
import { SearchFilters } from "@/components/search-filters";
import { SearchWhere } from "@/components/search-where";
import { SPORT_ICONS } from "@/components/sport-icons";
import { Text } from "@/components/text";
import { colors } from "@/lib/colors";
import { useHere } from "@/lib/distance";
import { groundParams, whenFilter } from "@/lib/ground-filter";
import { isRTL } from "@/lib/language";
import {
  ANY_TIME,
  appliedFilters,
  DEFAULT_RADIUS,
  filterQuery,
  type Filters,
  NO_FILTERS,
  type GroundSize,
  useAmenities,
  MAX_RADIUS,
  dayText,
  hourLabel,
  localDate,
  sizeName,
  sportName,
  useCoverage,
  useVenueSearch,
  whenText,
  type SearchParams,
  type When,
  type Where,
  type SearchSort,
  type Sport,
  type VenueCard,
} from "@/lib/search";

// Search (Figma "C3 · Tabs & Search"; the user picked options 1, 2 and 3 on 2026-11-20): venues free
// today near the player (or, when the phone can't say where it is, in the governorate with the most
// venues), narrowed by sport. Results come as big cards (option 1) or on a map with price pins
// (option 3); the compact rows (option 2) were dropped after trying them on the phone (user,
// 2026-11-20). Where and when (options 4 and 5) open from the search bar.
//
// The page scrolls as one, like the venue page: the big title rises into a white bar as it goes
// under it, and the search bar docks in the header (user, 2026-11-20). Changes animate, kept light:
// a chip's black fades, the order's label cross-fades and its arrow turns, results stay on screen
// until the new ones arrive and new ones fade in, and the list and the map cross-fade.

const Separator = () => <View className="my-6 h-px bg-border" />;

// Tennis after basketball: padel and tennis share a ball, so they aren't side by side (user,
// 2026-11-20).
const SPORTS: Sport[] = ["FOOTBALL", "PADEL", "BASKETBALL", "TENNIS", "VOLLEYBALL"];
const FOOTBALL_SIZES: GroundSize[] = ["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"];

const shadow = {
  shadowColor: "#0b0b0c",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
} as const;

// The order the list is in ("Nearest", "Cheapest"…): the words cross-fade when it changes, and a
// tap opens Filters, where it's picked.
function SortLabel({ sort, onPress }: { sort: SearchSort; onPress: () => void }) {
  const { t } = useTranslation();
  const name = t(`screens.search.filtersSheet.sortNames.${sort}`);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("screens.search.sorted", { sort: name })}
      hitSlop={8}
      onPress={onPress}
      className="flex-row items-center gap-1 active:opacity-60"
    >
      <IconArrowsSort size={16} color={colors.ink} strokeWidth={2} />
      <Animated.View layout={LinearTransition.duration(200)}>
        <Animated.View key={sort} entering={FadeIn.duration(180)} exiting={FadeOut.duration(100)}>
          <Text className="text-body font-medium">{name}</Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

// The where/when bar. In the list it floats and docks in the header as the page scrolls (Airbnb's
// pattern, user 2026-11-20): `docked` runs 0 → 1 as it arrives, shrinking it from 60 to 48 and
// folding its two lines into one. On the map it stays as it is.
function SearchPill({
  where,
  when,
  onPress,
  onFilter,
  onWhen,
  badge,
  docked,
  loading,
}: {
  where: string;
  when: string;
  // Still working out where the player is: bones in place of the two lines.
  loading: boolean;
  // The bar opens where (then when); its round button opens Filters, with how many are on.
  onPress: () => void;
  onFilter: () => void;
  // The when line opens when on its own.
  onWhen: () => void;
  badge: number;
  docked: DerivedValue<number> | null;
}) {
  const { t } = useTranslation();
  const box = useAnimatedStyle(() => ({
    height: docked ? interpolate(docked.value, [0, 1], [60, 48]) : 60,
    shadowOpacity: docked ? interpolate(docked.value, [0, 1], [0.08, 0.05]) : 0.08,
  }));
  const full = useAnimatedStyle(() => ({ opacity: docked ? 1 - docked.value : 1 }));
  const compact = useAnimatedStyle(() => ({ opacity: docked ? docked.value : 0 }));
  const button = useAnimatedStyle(() => ({
    transform: [{ scale: docked ? interpolate(docked.value, [0, 1], [1, 0.85]) : 1 }],
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${where}, ${when}`}
      onPress={onPress}
    >
      <Animated.View
        className="flex-row items-center gap-3 rounded-full border border-border bg-white pr-2 pl-5"
        style={[shadow, box]}
      >
        <IconSearch size={20} color={colors.ink} strokeWidth={2} />
        <View className="flex-1 justify-center self-stretch overflow-hidden">
          {loading ? (
            <>
              <Animated.View className="gap-1.5" style={full}>
                <Bone className="h-4 w-28 rounded-md" />
                <Bone className="h-3 w-40 rounded-md" />
              </Animated.View>
              <Animated.View className="absolute inset-0 justify-center" style={compact}>
                <Bone className="h-3.5 w-44 rounded-md" />
              </Animated.View>
            </>
          ) : (
            <>
              <Animated.View style={full}>
                <Text className="text-subtitle font-semibold">{where}</Text>
                <Pressable accessibilityRole="button" hitSlop={6} onPress={onWhen}>
                  <Text className="text-label text-ink-2">{when}</Text>
                </Pressable>
              </Animated.View>
              <Animated.View className="absolute inset-0 justify-center" style={compact}>
                <Text className="text-body font-semibold" numberOfLines={1}>
                  {where} <Text className="text-body text-ink-2">· {when}</Text>
                </Text>
              </Animated.View>
            </>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            badge > 0
              ? t("screens.search.filtersOn", { count: badge })
              : t("screens.search.filters")
          }
          hitSlop={6}
          onPress={onFilter}
        >
          <Animated.View
            className="size-10 items-center justify-center rounded-full border border-border"
            style={button}
          >
            <IconAdjustmentsHorizontal size={18} color={colors.ink} strokeWidth={2} />
            {badge > 0 ? (
              <View className="absolute -top-1 -right-1 size-[18px] items-center justify-center rounded-full border-2 border-white bg-ink">
                <Text className="text-[10px] leading-3 font-semibold text-white">{badge}</Text>
              </View>
            ) : null}
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

export default function SearchTab() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const phone = useHere();
  // Where and when, set from the search bar (options 4 and 5): near the player and today, any time,
  // an hour to start. "Near me" without a position looks in the governorate with the most venues.
  const [whereChoice, setWhereChoice] = useState<Where>({ kind: "near", radius: DEFAULT_RADIUS });
  const coverage = useCoverage();
  const fallback = coverage?.[0];
  const where: Where | null =
    whereChoice.kind === "near" && phone === null
      ? fallback
        ? { kind: "area", id: fallback.id, name: fallback.name ?? "", within: null }
        : null
      : whereChoice;
  const [when, setWhen] = useState<When>(ANY_TIME);
  const [editing, setEditing] = useState<"where" | "when" | "filters" | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const amenities = useAmenities();
  const here =
    where?.kind === "near"
      ? phone
      : where?.kind === "around"
        ? { latitude: where.latitude, longitude: where.longitude }
        : null;
  const radius = where?.kind === "near" || where?.kind === "around" ? where.radius : null;

  // Opened with a search already set (Similar venues, from a booking the venue couldn't take):
  // around that venue, the same sport and size, the same day, hour and length. Applied once per
  // link, keyed by its `at`; the player can change any of it after.
  const preset = useLocalSearchParams<{
    at?: string;
    near?: string;
    latitude?: string;
    longitude?: string;
    sport?: Sport;
    size?: GroundSize;
    date?: string;
    start?: string;
    hours?: string;
    // Home's See all: where Home looks (an area), the rail's order and its filter.
    area?: string;
    areaName?: string;
    sort?: SearchSort;
    instant?: string;
    priceMax?: string;
  }>();
  const presetApplied = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!preset.at || presetApplied.current === preset.at) return;
    presetApplied.current = preset.at;
    if (preset.latitude && preset.longitude)
      setWhereChoice({
        kind: "around",
        latitude: Number(preset.latitude),
        longitude: Number(preset.longitude),
        radius: DEFAULT_RADIUS,
        name: preset.near ?? "",
      });
    if (preset.area)
      setWhereChoice({ kind: "area", id: preset.area, name: preset.areaName ?? "", within: null });
    setSport(preset.sport);
    setSortChoice(preset.sort);
    setFilters({
      ...NO_FILTERS,
      size: preset.size,
      instant: preset.instant === "true",
      ...(preset.priceMax ? { priceMax: Number(preset.priceMax) } : {}),
    });
    setWhen({
      date: preset.date ?? null,
      start: preset.start ?? null,
      hours: Number(preset.hours ?? 1),
    });
  }, [preset]);
  const [sport, setSport] = useState<Sport | undefined>(undefined);
  // The chips follow a tap at once; the search (and the list it redraws) follows right after, so
  // the tap never waits on the list.
  const searchedSport = useDeferredValue(sport);
  const [sortChoice, setSortChoice] = useState<SearchSort | undefined>(undefined);
  // The list or the map, cross-faded.
  const [mode, setMode] = useState<"list" | "map">("list");
  const [header, setHeader] = useState(0);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  // The bar: where it starts in the page (its slot under the title), and where it docks, just
  // under the status bar. It follows the page up until it docks, then stays.
  const pillStart = useSharedValue(insets.top + 16 + 50);
  const dockAt = insets.top + 6;
  // 0 while the bar is in the page, 1 once docked, over its last 24 points up.
  const docked = useDerivedValue(() =>
    interpolate(pillStart.value - scrollY.value, [dockAt + 24, dockAt], [0, 1], "clamp"),
  );
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(dockAt, pillStart.value - scrollY.value) }],
  }));
  const headerStyle = useAnimatedStyle(() => ({ opacity: docked.value }));

  // Best match unless the player picks another order; nearest needs a point.
  const sort: SearchSort =
    sortChoice && (sortChoice !== "DISTANCE" || here) ? sortChoice : "BEST_MATCH";
  // The search without its when, which the when sheet counts against.
  const whereParams: SearchParams = {
    ...(here && radius ? { latitude: here.latitude, longitude: here.longitude, radius } : {}),
    ...(where?.kind === "area" ? { area: where.id } : {}),
    ...(searchedSport ? { sport: searchedSport } : {}),
    ...filterQuery(filters),
    sort,
  };
  // The search without its filters and order, which the Filters sheet counts against.
  const whereParamsWithout: SearchParams = {
    ...(here && radius ? { latitude: here.latitude, longitude: here.longitude, radius } : {}),
    ...(where?.kind === "area" ? { area: where.id } : {}),
    ...(searchedSport ? { sport: searchedSport } : {}),
    ...(when.date ? { date: when.date } : {}),
    ...(when.start ? { start: when.start } : {}),
    hours: when.hours,
  };
  const search = useVenueSearch(
    {
      ...whereParams,
      ...(when.date ? { date: when.date } : {}),
      ...(when.start ? { start: when.start } : {}),
      hours: when.hours,
    },
    phone !== undefined && where !== null,
  );

  // No day picked, and the server searched tomorrow (today has nothing left): take that day, so the
  // bar says Tomorrow, the When sheet has it picked, and a venue opens on it.
  useEffect(() => {
    if (when.date === null && search.date && search.date !== localDate(search.timezone))
      setWhen((now) => (now.date === null ? { ...now, date: search.date } : now));
  }, [when.date, search.date, search.timezone]);

  // Pulled down from the top: the search again, the spinner held until it's back.
  const pull = usePullToRefresh({ scrollY, busy: search.loading, onRefresh: search.refresh });

  const total = search.total;
  const summary =
    total === null
      ? " "
      : // The count found: the search bar already says where and when (user, 2026-11-20).
        t("screens.search.found", { count: total });

  const whereLabel =
    where?.kind === "around"
      ? t("screens.search.near", { place: where.name })
      : here
        ? t("screens.search.nearMe")
        : where?.kind === "area"
          ? where.name
          : " ";
  const whenLabel = whenText(when, search.timezone);
  // Where isn't known yet: the phone's still finding itself, or the fallback area hasn't come.
  const locating = phone === undefined || where === null;
  const openWhere = () => setEditing("where");
  const openWhen = () => setEditing("when");
  const openFilters = () => setEditing("filters");
  // The chips row (Figma B2, 133:2): Filters with how many are on, the sport (the others hidden
  // once one is picked; tap it again for all), its sizes, then what's applied, each with an ×.
  const applied = appliedFilters(
    filters,
    search.currency,
    new Map(amenities.map((amenity) => [amenity.id, amenity.name])),
  );
  const onChip = useCallback(
    (id: string) => {
      if (id === "filters") setEditing("filters");
      else if (id.startsWith("sport:")) {
        const picked = id.slice(6) as Sport;
        setSport((current) => (current === picked ? undefined : picked));
        if (picked !== "FOOTBALL") setFilters((current) => ({ ...current, size: undefined }));
      } else if (id.startsWith("size:")) {
        const size = id.slice(5) as GroundSize;
        setFilters((current) => ({ ...current, size: current.size === size ? undefined : size }));
      } else {
        setFilters((current) => {
          const chip = appliedFilters(current, "", new Map()).find((each) => each.key === id);
          return chip ? chip.without : current;
        });
      }
    },
    [setSport],
  );
  const chips = (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -24 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 24 }}
      >
        <Chip
          id="filters"
          label={
            applied.length > 0
              ? t("screens.search.filtersCount", { count: applied.length })
              : t("screens.search.filters")
          }
          on={false}
          icon={<IconAdjustmentsHorizontal size={16} color={colors.ink} strokeWidth={2} />}
          onSelect={onChip}
        />
        {(sport ? [sport] : SPORTS).map((each) => (
          <Chip
            key={each}
            id={`sport:${each}`}
            label={sportName(each)}
            ball={SPORT_ICONS[each]}
            on={sport === each}
            onSelect={onChip}
          />
        ))}
        {sport === "FOOTBALL"
          ? FOOTBALL_SIZES.map((size) => (
              <Chip
                key={size}
                id={`size:${size}`}
                label={sizeName(size)}
                on={filters.size === size}
                onSelect={onChip}
              />
            ))
          : null}
        {applied.map((chip) => (
          <Chip
            key={chip.key}
            id={chip.key}
            label={chip.label}
            on={false}
            removable
            onSelect={onChip}
          />
        ))}
      </ScrollView>
    </View>
  );

  // What the search asks of a venue's grounds, for its page to grey out the rest (lib/
  // ground-filter.ts). Kept by value, so the memoised cards only redraw when it really changes.
  const groundKey = JSON.stringify(
    groundParams({
      ...whenFilter(when),
      sport: searchedSport,
      size: filters.size,
      surfaces: filters.surfaces,
      settings: filters.settings,
      priceMin: filters.priceMin,
      priceMax: filters.priceMax,
    }),
  );
  const venueParams = useMemo(() => JSON.parse(groundKey) as Record<string, string>, [groundKey]);
  const mapView = (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <SearchMap
        cards={search.cards}
        sort={sort}
        currency={search.currency}
        timezone={search.timezone}
        params={venueParams}
        here={phone ?? null}
        top={header}
        bottom={0}
        onList={() => setMode("list")}
      />
      <View
        className="absolute right-0 left-0 px-6"
        style={{ top: insets.top + 8 }}
        onLayout={(event) => setHeader(event.nativeEvent.layout.height + insets.top + 8)}
        pointerEvents="box-none"
      >
        {/* The bar alone: no sport chips and no switch here (user, 2026-11-20); the List pill at
            the bottom goes back. */}
        <SearchPill
          where={whereLabel}
          when={whenLabel}
          onPress={openWhere}
          onFilter={openFilters}
          onWhen={openWhen}
          badge={applied.length}
          docked={null}
          loading={locating}
        />
      </View>
    </View>
  );

  // Stable, so the list doesn't redraw every card when Search re-renders.
  const { currency, timezone } = search;
  const renderItem = useCallback(
    ({ item }: { item: VenueCard }) => (
      <Animated.View entering={FadeIn.duration(200)}>
        <VenueListCard card={item} currency={currency} timezone={timezone} params={venueParams} />
      </Animated.View>
    ),
    [currency, timezone, venueParams],
  );

  const empty = search.loading ? (
    <View className="items-center pt-16">
      <ActivityIndicator color={colors.ink} />
    </View>
  ) : search.error ? (
    // Unplugged, like every other page that couldn't load: offline, or the API's few words.
    <Animated.View entering={FadeIn.duration(260)} className="items-center px-2 pt-6">
      <FailedMessage error={search.error} />
      <View className="mt-6">
        <Button label={t("common.actions.tryAgain")} size="small" onPress={search.refresh} />
      </View>
    </Animated.View>
  ) : (
    // "Lights out" (Figma 114:2): what wasn't found, and the one way out.
    <Animated.View entering={FadeIn.duration(260)} className="items-center px-2 pt-6">
      <LightsOutArt />
      <Text className="mt-3 text-heading font-semibold">{t("screens.search.empty.title")}</Text>
      <Text className="mt-2 text-center text-subtitle text-ink-2">
        {t("screens.search.empty.sentence", {
          what: searchedSport
            ? t(`screens.search.empty.places.${searchedSport}`)
            : t("screens.search.empty.venues"),
          where: here
            ? t("screens.search.empty.within", { km: radius })
            : where?.kind === "area"
              ? t("screens.search.empty.in", { area: where.name })
              : "",
          when: when.start
            ? t("screens.search.empty.freeAt", {
                day: dayText(when.date, search.timezone).toLowerCase(),
                hour: hourLabel(Number(when.start.slice(0, 2))),
              })
            : when.date
              ? t("screens.search.empty.freeOn", { day: dayText(when.date, search.timezone) })
              : t("screens.search.empty.freeToday"),
        })}
      </Text>
      {applied.length > 0 || filters.size ? (
        <View className="mt-6">
          <Button
            label={t("screens.search.clearFilters")}
            size="small"
            quietLabel
            onPress={() => setFilters(NO_FILTERS)}
          />
        </View>
      ) : here && radius !== null && radius < MAX_RADIUS ? (
        <View className="mt-6">
          <Button
            label={t("common.searchWithin", { km: MAX_RADIUS })}
            size="small"
            quietLabel
            onPress={() => setWhereChoice({ kind: "near", radius: MAX_RADIUS })}
          />
        </View>
      ) : sport ? (
        <View className="mt-6">
          <Button
            label={t("screens.search.showAllSports")}
            size="small"
            quietLabel
            onPress={() => setSport(undefined)}
          />
        </View>
      ) : null}
    </Animated.View>
  );

  const listView = (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <Animated.FlatList
        data={search.cards}
        keyExtractor={(card: VenueCard) => card.id}
        onScroll={onScroll}
        scrollEventThrottle={16}
        // Venues new to the list fade in (opacity only).
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <View className="gap-4 pb-5">
            <Text accessibilityRole="header" className="text-title font-semibold tracking-[-0.4px]">
              {t("screens.search.title")}
            </Text>
            {/* The bar's slot: the bar itself floats over it (below), so it can dock. */}
            <View
              className="h-[60px]"
              onLayout={(event) => {
                pillStart.value = insets.top + 16 + event.nativeEvent.layout.y;
              }}
            />
            {chips}
            <View className="flex-row items-center justify-between">
              <Text className="text-body text-ink-2">{summary}</Text>
              <SortLabel sort={sort} onPress={openFilters} />
            </View>
          </View>
        }
        ListEmptyComponent={empty}
        ListFooterComponent={
          search.loadingMore ? (
            <View className="py-8">
              <ActivityIndicator color={colors.ink} />
            </View>
          ) : undefined
        }
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: insets.top + 16,
          paddingBottom: 96,
        }}
        onEndReached={search.loadMore}
        onEndReachedThreshold={0.6}
        refreshControl={pull.control}
      />

      {pull.spinner}

      {/* The header the bar docks in: white, fading in as the bar arrives. */}
      <Animated.View
        pointerEvents="none"
        className="absolute top-0 right-0 left-0 border-b border-hairline bg-white"
        style={[{ height: dockAt + 48 + 10 }, headerStyle]}
      />
      <Animated.View className="absolute top-0 right-6 left-6" style={pillStyle}>
        <SearchPill
          where={whereLabel}
          when={whenLabel}
          onPress={openWhere}
          onFilter={openFilters}
          onWhen={openWhen}
          badge={applied.length}
          docked={docked}
          loading={locating}
        />
      </Animated.View>

      {search.cards.length > 0 ? (
        <View
          className="absolute right-0 left-0 items-center"
          style={{ bottom: 16 }}
          pointerEvents="box-none"
        >
          <MapToggle
            label={t("screens.search.map")}
            icon={<IconMap size={18} color={colors.white} strokeWidth={2} />}
            onPress={() => setMode("map")}
          />
        </View>
      ) : null}
    </View>
  );

  // The list and the map fade over each other; where covers both while it's being chosen, and when
  // is a sheet over them. Not a Screen, so it sets the direction itself.
  return (
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      {mode === "map" ? (
        <Animated.View
          key="map"
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(180)}
          style={StyleSheet.absoluteFill}
        >
          {mapView}
        </Animated.View>
      ) : (
        <Animated.View
          key="list"
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(180)}
          style={StyleSheet.absoluteFill}
        >
          {listView}
        </Animated.View>
      )}
      {editing === "where" ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(150)}
          style={StyleSheet.absoluteFill}
        >
          <SearchWhere
            here={phone ?? null}
            where={where ?? whereChoice}
            params={{
              ...(searchedSport ? { sport: searchedSport } : {}),
              ...(when.date ? { date: when.date } : {}),
              ...(when.start ? { start: when.start } : {}),
              hours: when.hours,
            }}
            onPick={(next) => {
              setWhereChoice(next);
              setEditing("when");
            }}
            onClose={() => setEditing(null)}
          />
        </Animated.View>
      ) : null}
      <SearchFilters
        visible={editing === "filters"}
        filters={filters}
        sort={sort}
        near={Boolean(here)}
        sport={sport}
        params={whereParamsWithout}
        currency={search.currency}
        onApply={(next, nextSort) => {
          setFilters(next);
          setSortChoice(nextSort);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
      <SearchWhen
        visible={editing === "when"}
        when={when}
        timezone={search.timezone}
        params={whereParams}
        onApply={(next) => {
          setWhen(next);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    </View>
  );
}
