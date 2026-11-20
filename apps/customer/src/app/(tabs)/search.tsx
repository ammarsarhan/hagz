import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, View } from "react-native";
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
import { useTabBarHeight } from "@/components/tab-bar";
import { Text } from "@/components/text";
import { colors } from "@/lib/colors";
import { useHere } from "@/lib/distance";
import { sportName, useVenueSearch, type SearchSort, type Sport } from "@/lib/search";

// Search (Figma "C3 · Tabs & Search"; the user picked options 1, 2 and 3 on 2026-11-20, built behind
// one switch to compare on the phone): venues free today near the player (or anywhere, best rated
// first, when the phone can't say where it is), narrowed by sport. Results come as big cards
// (option 1) or compact rows (option 2), or on a map with price pins (option 3). Changing where and
// when (options 4 and 5) isn't built yet, so the search bar says so.

const SPORTS: Sport[] = ["FOOTBALL", "PADEL", "TENNIS", "BASKETBALL", "VOLLEYBALL"];
type View_ = "cards" | "rows" | "map";

const shadow = {
  shadowColor: "#0b0b0c",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
} as const;

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={`h-10 justify-center rounded-full px-4 ${on ? "bg-ink" : "border border-border bg-white"}`}
    >
      <Text className={`text-body font-medium ${on ? "text-white" : "text-ink"}`}>{label}</Text>
    </Pressable>
  );
}

export default function SearchTab() {
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarHeight();
  const hud = useHud();
  const phone = useHere();
  // Near the player, until they ask for everywhere (offered when nothing's near).
  const [everywhere, setEverywhere] = useState(false);
  const here = everywhere ? null : phone;
  const [sport, setSport] = useState<Sport | undefined>(undefined);
  const [sortChoice, setSortChoice] = useState<SearchSort | undefined>(undefined);
  const [view, setView] = useState<View_>("cards");
  const [header, setHeader] = useState(0);

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

  const bar = (
    <View className="gap-3">
      <Pressable
        accessibilityRole="button"
        onPress={soon}
        className="h-[60px] flex-row items-center gap-3 rounded-full border border-border bg-white pr-2 pl-5"
        style={shadow}
      >
        <IconSearch size={20} color={colors.ink} strokeWidth={2} />
        <View className="flex-1">
          <Text className="text-subtitle font-semibold">{here ? "Near me" : "All of Egypt"}</Text>
          <Text className="text-label text-ink-2">Today · any time · 1 hour</Text>
        </View>
        <View className="size-10 items-center justify-center rounded-full border border-border">
          <IconAdjustmentsHorizontal size={18} color={colors.ink} strokeWidth={2} />
        </View>
      </Pressable>
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

  if (view === "map") {
    return (
      <View className="flex-1 bg-white">
        <StatusBar style="dark" />
        <SearchMap
          cards={search.cards}
          currency={search.currency}
          timezone={search.timezone}
          here={phone ?? null}
          top={header}
          bottom={tabBar}
        />
        <View
          className="absolute right-0 left-0 px-6"
          style={{ top: insets.top + 8 }}
          onLayout={(event) => setHeader(event.nativeEvent.layout.height + insets.top + 8)}
          pointerEvents="box-none"
        >
          {bar}
          <View className="mt-3 items-end">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show the list"
              onPress={() => setView("cards")}
              className="size-11 items-center justify-center rounded-full bg-white"
              style={shadow}
            >
              <IconList size={20} color={colors.ink} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const Item = view === "cards" ? VenueCardLarge : VenueRow;
  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <StatusBar style="dark" />
      <View className="gap-4 px-6 pt-4 pb-3">
        <Text accessibilityRole="header" className="text-title font-semibold tracking-[-0.4px]">
          Search
        </Text>
        {bar}
        <View className="flex-row items-center justify-between">
          <Text className="text-body text-ink-2">{summary}</Text>
          <View className="flex-row items-center gap-4">
            <Pressable
              accessibilityRole="button"
              disabled={!here}
              hitSlop={8}
              onPress={() => setSortChoice(sort === "DISTANCE" ? "RATING" : "DISTANCE")}
              className="flex-row items-center gap-1 active:opacity-60"
            >
              <IconArrowsSort size={16} color={colors.ink} strokeWidth={2} />
              <Text className="text-body font-medium">
                {sort === "DISTANCE" ? "Nearest" : "Best rated"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={view === "cards" ? "Show as rows" : "Show as cards"}
              hitSlop={8}
              onPress={() => setView(view === "cards" ? "rows" : "cards")}
              className="active:opacity-60"
            >
              {view === "cards" ? (
                <IconLayoutList size={20} color={colors.ink} strokeWidth={2} />
              ) : (
                <IconLayoutGrid size={20} color={colors.ink} strokeWidth={2} />
              )}
            </Pressable>
          </View>
        </View>
      </View>
      <FlatList
        data={search.cards}
        keyExtractor={(card) => card.id}
        renderItem={({ item }) => (
          <Item card={item} currency={search.currency} timezone={search.timezone} />
        )}
        ItemSeparatorComponent={() => <View className="my-6 h-px bg-border" />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 96 }}
        onEndReached={search.loadMore}
        onEndReachedThreshold={0.6}
        refreshing={false}
        onRefresh={search.refresh}
        ListEmptyComponent={
          search.loading ? undefined : search.error ? (
            <View className="items-start gap-4 pt-10">
              <Text className="text-subtitle text-ink-2">{search.error}</Text>
              <Button label="Try again" onPress={search.refresh} />
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
                  <Button label="Search all of Egypt" onPress={() => setEverywhere(true)} />
                </View>
              ) : null}
            </View>
          )
        }
        ListFooterComponent={
          search.loading ? (
            <View className="py-8">
              <ActivityIndicator color={colors.ink} />
            </View>
          ) : undefined
        }
      />
      {search.cards.length > 0 ? (
        <View className="absolute right-0 left-0 items-center" style={{ bottom: tabBar + 16 }}>
          <MapToggle
            label="Map"
            icon={<IconMap size={18} color={colors.white} strokeWidth={2} />}
            onPress={() => setView("map")}
          />
        </View>
      ) : null}
    </View>
  );
}
