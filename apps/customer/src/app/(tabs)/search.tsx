import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  runOnJS,
  type DerivedValue,
  type SharedValue,
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
import { useHud } from "@/components/hud";
import {
  IconAdjustmentsHorizontal,
  IconArrowsSort,
  IconLayoutGrid,
  IconLayoutList,
  IconList,
  IconMap,
  IconSearch,
} from "@/components/icons";
import { VenueCardLarge, VenueRow } from "@/components/search-cards";
import { MapToggle, SearchMap } from "@/components/search-map";
import { Text } from "@/components/text";
import { colors } from "@/lib/colors";
import { useHere } from "@/lib/distance";
import {
  sportName,
  useVenueSearch,
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
// until the new ones arrive and new ones fade in, cards ⟷ rows fades and scales the venues on
// screen, and the list and the map cross-fade.

const SPORTS: Sport[] = ["FOOTBALL", "PADEL", "TENNIS", "BASKETBALL", "VOLLEYBALL"];

const shadow = {
  shadowColor: "#0b0b0c",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
} as const;

// A filter chip: picked, its black (with white words) fades in over the white one.
function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const shown = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(on ? 1 : 0, { duration: 180 });
  }, [on, shown]);
  const fill = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
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
}

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

// A venue in the list: fades in when it's new, and follows the cards ⟷ rows swap (opacity and a
// slight scale, both on the GPU).
function SwapItem({ swap, children }: { swap: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({
    opacity: swap.value,
    transform: [{ scale: 0.97 + 0.03 * swap.value }],
  }));
  return (
    <Animated.View entering={FadeIn.duration(200)} style={style}>
      {children}
    </Animated.View>
  );
}

// The where/when bar. In the list it floats and docks in the header as the page scrolls (Airbnb's
// pattern, user 2026-11-20): `docked` runs 0 → 1 as it arrives, shrinking it from 60 to 48 and
// folding its two lines into one. On the map it stays as it is.
function SearchPill({
  where,
  when,
  onPress,
  docked,
}: {
  where: string;
  when: string;
  onPress: () => void;
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
        <Animated.View
          className="size-10 items-center justify-center rounded-full border border-border"
          style={button}
        >
          <IconAdjustmentsHorizontal size={18} color={colors.ink} strokeWidth={2} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export default function SearchTab() {
  const insets = useSafeAreaInsets();
  const hud = useHud();
  const phone = useHere();
  // Near the player, until they ask for everywhere (offered when nothing's near).
  const [everywhere, setEverywhere] = useState(false);
  const here = everywhere ? null : phone;
  const [sport, setSport] = useState<Sport | undefined>(undefined);
  const [sortChoice, setSortChoice] = useState<SearchSort | undefined>(undefined);
  // The list or the map, cross-faded; and how the list shows venues.
  const [mode, setMode] = useState<"list" | "map">("list");
  const [layout, setLayout] = useState<"cards" | "rows">("cards");
  // Cards ⟷ rows: the venues on screen fade and shrink a touch, swap, and come back. Opacity and
  // scale only, which the GPU does cheaply; no layout animation.
  const swap = useSharedValue(1);
  const relayout = (next: "cards" | "rows") => {
    setLayout(next);
    swap.value = withTiming(1, { duration: 180 });
  };
  const toggleLayout = () => {
    const next = layout === "cards" ? "rows" : "cards";
    swap.value = withTiming(0, { duration: 120 }, (finished) => {
      if (finished) runOnJS(relayout)(next);
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
  const search = useVenueSearch(
    {
      ...(here ? { latitude: here.latitude, longitude: here.longitude } : {}),
      ...(sport ? { sport } : {}),
      sort,
    },
    phone !== undefined,
  );

  const soon = () => hud.show("Changing where and when comes next");
  const total = search.total;
  const summary =
    total === null
      ? " "
      : `${total} ${total === 1 ? "venue" : "venues"} free today${here ? "" : " in Egypt"}`;

  const where = here ? "Near me" : "All of Egypt";
  const when = "Today · any time · 1 hour";
  const chips = (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -24 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 24 }}
      >
        <Chip label="All" on={!sport} onPress={() => setSport(undefined)} />
        {SPORTS.map((each) => (
          <Chip
            key={each}
            label={sportName(each)}
            on={sport === each}
            onPress={() => setSport(sport === each ? undefined : each)}
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
      />
      <View
        className="absolute right-0 left-0 px-6"
        style={{ top: insets.top + 8 }}
        onLayout={(event) => setHeader(event.nativeEvent.layout.height + insets.top + 8)}
        pointerEvents="box-none"
      >
        {/* The bar, and the switch back to the list beside it at the bar's height. No sport chips
            here: the map keeps to the bar (user, 2026-11-20). */}
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <SearchPill where={where} when={when} onPress={soon} docked={null} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show the list"
            onPress={() => setMode("list")}
            className="size-[60px] items-center justify-center rounded-full border border-border bg-white active:opacity-80"
            style={shadow}
          >
            <IconList size={22} color={colors.ink} strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  const Item = layout === "cards" ? VenueCardLarge : VenueRow;
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
    <View className="items-start gap-2 pt-10">
      <Text className="text-heading font-semibold">
        {here ? "Nothing free near you today" : "Nothing free today"}
      </Text>
      <Text className="text-subtitle text-ink-2">
        {here
          ? "Nothing within 10 km has a free hour left today."
          : sport
            ? "Try another sport, or all of them."
            : "Check back later today."}
      </Text>
      {here ? (
        <View className="mt-4">
          <Button
            label="Search all of Egypt"
            size="small"
            quietLabel
            onPress={() => setEverywhere(true)}
          />
        </View>
      ) : null}
    </View>
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
        renderItem={({ item }: { item: VenueCard }) => (
          <SwapItem swap={swap}>
            <Item card={item} currency={search.currency} timezone={search.timezone} />
          </SwapItem>
        )}
        ItemSeparatorComponent={() => <View className="my-6 h-px bg-border" />}
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
        <SearchPill where={where} when={when} onPress={soon} docked={docked} />
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

  // The list and the map fade over each other.
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
    </View>
  );
}
