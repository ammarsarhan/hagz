import { StatusBar } from "expo-status-bar";
import { memo, useCallback, useDeferredValue, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  type DerivedValue,
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { LightsOutArt } from "@/components/lights-out-art";
import {
  IconAdjustmentsHorizontal,
  IconArrowsSort,
  IconLayoutGrid,
  IconLayoutList,
  IconMap,
  IconSearch,
} from "@/components/icons";
import { VenueListCard } from "@/components/search-cards";
import { MapToggle, SearchMap } from "@/components/search-map";
import { SearchWhen } from "@/components/search-when";
import { SearchWhere } from "@/components/search-where";
import { Text } from "@/components/text";
import { colors } from "@/lib/colors";
import { useHere } from "@/lib/distance";
import {
  ANY_TIME,
  dayText,
  hourLabel,
  sportName,
  useVenueSearch,
  whenText,
  type SearchParams,
  type When,
  type Where,
  type SearchSort,
  type Sport,
  type VenueCard,
} from "@/lib/search";

// Search (Figma "C3 · Tabs & Search"; the user picked options 1, 2 and 3 on 2026-11-20, built behind
// one switch to compare on the phone): venues free today near the player (or anywhere, best rated
// first, when the phone can't say where it is), narrowed by sport. Results come as big cards
// (option 1) or compact rows (option 2), or on a map with price pins (option 3). Changing where and
// when (options 4 and 5) isn't built yet, so the search bar says so.
//
// The page scrolls as one, like the venue page: the big title rises into a white bar as it goes
// under it, and the search bar docks in the header (user, 2026-11-20). Changes animate, kept light:
// a chip's black fades, the order's label cross-fades and its arrow turns, results stay on screen
// until the new ones arrive and new ones fade in, cards ⟷ rows morphs each card (cover into
// thumbnail, words sliding beside it), and the list and the map cross-fade.

const Separator = () => <View className="my-6 h-px bg-border" />;

const SPORTS: Sport[] = ["FOOTBALL", "PADEL", "TENNIS", "BASKETBALL", "VOLLEYBALL"];
// What a sport is played on, for "No padel courts have a free hour left today."
const SPORT_PLACES: Record<Sport, string> = {
  FOOTBALL: "football pitches",
  PADEL: "padel courts",
  TENNIS: "tennis courts",
  BASKETBALL: "basketball courts",
  VOLLEYBALL: "volleyball courts",
};

const shadow = {
  shadowColor: "#0b0b0c",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
} as const;

// A filter chip: picked, its black (with white words) fades in over the white one.
// Memoised with a value and one stable handler, so a tap re-renders only the two chips that change.
const Chip = memo(function Chip({
  label,
  value,
  on,
  onSelect,
}: {
  label: string;
  value: Sport | undefined;
  on: boolean;
  onSelect: (value: Sport | undefined) => void;
}) {
  const shown = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(on ? 1 : 0, { duration: 180 });
  }, [on, shown]);
  const fill = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={() => onSelect(value)}
      className="h-10 justify-center rounded-full border border-border bg-white px-4"
    >
      <Text className="text-body font-medium">{label}</Text>
      <Animated.View
        pointerEvents="none"
        className="absolute -inset-px items-center justify-center rounded-full bg-ink"
        style={fill}
      >
        <Text className="text-body font-medium text-white">{label}</Text>
      </Animated.View>
    </Pressable>
  );
});

// "Nearest" or "Best rated": the words cross-fade and the arrow turns when it changes.
function SortToggle({
  sort,
  enabled,
  onPress,
}: {
  sort: SearchSort;
  enabled: boolean;
  onPress: () => void;
}) {
  const turn = useSharedValue(sort === "DISTANCE" ? 0 : 1);
  useEffect(() => {
    turn.value = withTiming(sort === "DISTANCE" ? 0 : 1, { duration: 220 });
  }, [sort, turn]);
  const arrow = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(turn.value, [0, 1], [0, 180])}deg` }],
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sort === "DISTANCE" ? "Sorted nearest first" : "Sorted best rated first"}
      disabled={!enabled}
      hitSlop={8}
      onPress={onPress}
      className="flex-row items-center gap-1 active:opacity-60"
    >
      <Animated.View style={arrow}>
        <IconArrowsSort size={16} color={colors.ink} strokeWidth={2} />
      </Animated.View>
      <Animated.View layout={LinearTransition.duration(200)}>
        <Animated.View key={sort} entering={FadeIn.duration(180)} exiting={FadeOut.duration(100)}>
          <Text className="text-body font-medium">
            {sort === "DISTANCE" ? "Nearest" : "Best rated"}
          </Text>
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
  docked,
}: {
  where: string;
  when: string;
  // The bar opens where; its round button opens when (until there are filters).
  onPress: () => void;
  onFilter: () => void;
  docked: DerivedValue<number> | null;
}) {
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
          <Animated.View style={full}>
            <Text className="text-subtitle font-semibold">{where}</Text>
            <Text className="text-label text-ink-2">{when}</Text>
          </Animated.View>
          <Animated.View className="absolute inset-0 justify-center" style={compact}>
            <Text className="text-body font-semibold" numberOfLines={1}>
              {where} <Text className="text-body text-ink-2">· {when}</Text>
            </Text>
          </Animated.View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="When to play"
          hitSlop={6}
          onPress={onFilter}
        >
          <Animated.View
            className="size-10 items-center justify-center rounded-full border border-border"
            style={button}
          >
            <IconAdjustmentsHorizontal size={18} color={colors.ink} strokeWidth={2} />
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

export default function SearchTab() {
  const insets = useSafeAreaInsets();
  const phone = useHere();
  // Where and when, set from the search bar (options 4 and 5): near the player and today, any time,
  // an hour to start. "Near me" without a position searches everywhere.
  const [whereChoice, setWhereChoice] = useState<Where>({ kind: "near" });
  const [when, setWhen] = useState<When>(ANY_TIME);
  const [editing, setEditing] = useState<"where" | "when" | null>(null);
  const here = whereChoice.kind === "near" ? phone : null;
  const [sport, setSport] = useState<Sport | undefined>(undefined);
  // The chips follow a tap at once; the search (and the list it redraws) follows right after, so
  // the tap never waits on the list.
  const searchedSport = useDeferredValue(sport);
  const [sortChoice, setSortChoice] = useState<SearchSort | undefined>(undefined);
  // The list or the map, cross-faded; and how the list shows venues.
  const [mode, setMode] = useState<"list" | "map">("list");
  const [layout, setLayout] = useState<"cards" | "rows">("cards");
  // Cards ⟷ rows: every card on screen morphs (its photo shrinking into a thumbnail, the words
  // sliding beside it), driven by this one value on the UI thread.
  const compact = useSharedValue(0);
  const toggleLayout = () => {
    const next = layout === "cards" ? "rows" : "cards";
    setLayout(next);
    compact.value = withTiming(next === "rows" ? 1 : 0, {
      duration: 320,
      easing: Easing.inOut(Easing.cubic),
    });
  };
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

  // Nearest first when the phone knows where it is; best rated otherwise.
  const sort: SearchSort = here ? (sortChoice ?? "DISTANCE") : "RATING";
  // The search without its when, which the when sheet counts against.
  const whereParams: SearchParams = {
    ...(here ? { latitude: here.latitude, longitude: here.longitude } : {}),
    ...(whereChoice.kind === "area" ? { area: whereChoice.id } : {}),
    ...(searchedSport ? { sport: searchedSport } : {}),
    sort,
  };
  const search = useVenueSearch(
    {
      ...whereParams,
      ...(when.date ? { date: when.date } : {}),
      ...(when.start ? { start: when.start } : {}),
      hours: when.hours,
    },
    phone !== undefined,
  );

  const total = search.total;
  const summary =
    total === null
      ? " "
      : // The count found: the search bar already says where and when (user, 2026-11-20).
        `${total} ${total === 1 ? "venue" : "venues"} found`;

  const whereLabel = here
    ? "Near me"
    : whereChoice.kind === "area"
      ? whereChoice.name
      : "All of Egypt";
  const whenLabel = whenText(when, search.timezone);
  const openWhere = () => setEditing("where");
  const openWhen = () => setEditing("when");
  const chips = (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -24 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 24 }}
      >
        <Chip label="All" value={undefined} on={!sport} onSelect={setSport} />
        {SPORTS.map((each) => (
          <Chip
            key={each}
            label={sportName(each)}
            value={each}
            on={sport === each}
            onSelect={setSport}
          />
        ))}
      </ScrollView>
    </View>
  );

  const mapView = (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <SearchMap
        cards={search.cards}
        currency={search.currency}
        timezone={search.timezone}
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
          onFilter={openWhen}
          docked={null}
        />
      </View>
    </View>
  );

  // Stable, so the list doesn't redraw every card when Search re-renders.
  const { currency, timezone } = search;
  const renderItem = useCallback(
    ({ item }: { item: VenueCard }) => (
      <Animated.View entering={FadeIn.duration(200)}>
        <VenueListCard card={item} currency={currency} timezone={timezone} compact={compact} />
      </Animated.View>
    ),
    [currency, timezone, compact],
  );

  const empty = search.loading ? (
    <View className="items-center pt-16">
      <ActivityIndicator color={colors.ink} />
    </View>
  ) : search.error ? (
    <View className="items-start gap-4 pt-10">
      <Text className="text-subtitle text-ink-2">{search.error}</Text>
      <Button label="Try again" size="small" onPress={search.refresh} />
    </View>
  ) : (
    // "Lights out" (Figma 114:2): what wasn't found, and the one way out.
    <Animated.View entering={FadeIn.duration(260)} className="items-center px-2 pt-6">
      <LightsOutArt />
      <Text className="mt-3 text-heading font-semibold">Uh oh!</Text>
      <Text className="mt-2 text-center text-subtitle text-ink-2">
        {`No ${searchedSport ? SPORT_PLACES[searchedSport] : "venues"}${
          here ? " within 10 km" : whereChoice.kind === "area" ? ` in ${whereChoice.name}` : ""
        } ${
          when.start
            ? `are free ${dayText(when.date, search.timezone).toLowerCase()} at ${hourLabel(Number(when.start.slice(0, 2)))}`
            : when.date
              ? `have a free hour on ${dayText(when.date, search.timezone)}`
              : "have a free hour left today"
        }.`}
      </Text>
      {here ? (
        <View className="mt-6">
          <Button
            label="Search all of Egypt"
            size="small"
            quietLabel
            onPress={() => setWhereChoice({ kind: "everywhere" })}
          />
        </View>
      ) : sport ? (
        <View className="mt-6">
          <Button
            label="Show all sports"
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
              Search
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
              <View className="flex-row items-center gap-4">
                <SortToggle
                  sort={sort}
                  enabled={Boolean(here)}
                  onPress={() => setSortChoice(sort === "DISTANCE" ? "RATING" : "DISTANCE")}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={layout === "cards" ? "Show as rows" : "Show as cards"}
                  hitSlop={8}
                  onPress={toggleLayout}
                  className="active:opacity-60"
                >
                  {layout === "cards" ? (
                    <IconLayoutList size={20} color={colors.ink} strokeWidth={2} />
                  ) : (
                    <IconLayoutGrid size={20} color={colors.ink} strokeWidth={2} />
                  )}
                </Pressable>
              </View>
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
        refreshing={false}
        onRefresh={search.refresh}
      />

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
          onFilter={openWhen}
          docked={docked}
        />
      </Animated.View>

      {search.cards.length > 0 ? (
        <View
          className="absolute right-0 left-0 items-center"
          style={{ bottom: 16 }}
          pointerEvents="box-none"
        >
          <MapToggle
            label="Map"
            icon={<IconMap size={18} color={colors.white} strokeWidth={2} />}
            onPress={() => setMode("map")}
          />
        </View>
      ) : null}
    </View>
  );

  // The list and the map fade over each other; where covers both while it's being chosen, and when
  // is a sheet over them.
  return (
    <View className="flex-1 bg-white">
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
            onPick={(next) => {
              setWhereChoice(next);
              setEditing("when");
            }}
            onClose={() => setEditing(null)}
          />
        </Animated.View>
      ) : null}
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
