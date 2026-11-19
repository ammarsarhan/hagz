import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { useHud, useHudAnchor } from "@/components/hud";
import { IconChevronLeft } from "@/components/icons";
import { Text } from "@/components/text";
import {
  AboutSection,
  AmenitiesSection,
  BookingSection,
  Figures,
  FreeToday,
  GroundsSection,
  ReviewsSection,
  VenueHeader,
  WhereSection,
} from "@/components/venue-sections";
import { api, reachable } from "@/lib/api";
import { hudMessage, problem, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { formatPrice } from "@/lib/money";
import { cheapestHour, paymentLabel, type PublicVenue, type VenueAvailability } from "@/lib/venue";

// The venue page (Figma C5, frames 59:2 and 60:2; PR 3.2): photos edge to edge under the status
// bar, then the venue, today's free times, and every section a player checks before booking, with
// Book pinned to the bottom. Public, so guests see all of it.
//
// As the photos scroll away, a white bar fades in behind the back button; once the tabs reach it,
// they stay there, and tapping one scrolls to its section. Booking itself (the day and time sheet,
// the ground picker) comes next, so Book and the time chips say so for now.

const PHOTO_HEIGHT = 320;
const BAR = 56;
const TABS = 46;

type Tab = "grounds" | "booking" | "amenities" | "reviews" | "map";
const TAB_LABELS: Record<Tab, string> = {
  grounds: "Grounds",
  booking: "Booking",
  amenities: "Amenities",
  reviews: "Reviews",
  map: "Map",
};

// The local date after this one (YYYY-MM-DD).
const nextDate = (date: string) => {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
};

type Loaded =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "failed"; message: string }
  | { state: "ready"; venue: PublicVenue; availability: VenueAvailability | null };

export default function VenuePage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [venue, availability] = await Promise.all([
        send(api.GET("/v1/venues/{slug}", { params: { path: { slug } } })),
        send(api.GET("/v1/venues/{slug}/availability", { params: { path: { slug } } })),
      ]);
      if (!active) return;
      if (venue.ok) {
        // Late in the day there's often nothing left: show tomorrow's times instead of an empty row.
        let day = availability.ok ? availability.data : null;
        if (day && day.slots.length === 0 && venue.data.status === "LIVE") {
          const next = await send(
            api.GET("/v1/venues/{slug}/availability", {
              params: { path: { slug }, query: { date: nextDate(day.date) } },
            }),
          );
          if (!active) return;
          if (next.ok) day = next.data;
        }
        setLoaded({ state: "ready", venue: venue.data, availability: day });
      } else if (problem(venue.error)?.code === "VENUE_NOT_FOUND") {
        setLoaded({ state: "missing" });
      } else {
        setLoaded({ state: "failed", message: hudMessage(venue.error) });
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, attempt]);

  if (loaded.state === "ready") {
    return <VenueView venue={loaded.venue} availability={loaded.availability} />;
  }
  return (
    <Waiting
      loaded={loaded}
      onRetry={() => {
        setLoaded({ state: "loading" });
        setAttempt((n) => n + 1);
      }}
    />
  );
}

// Loading, a venue that isn't public (or never was), or one that couldn't be read.
function Waiting({ loaded, onRetry }: { loaded: Loaded; onRetry: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-white px-5" style={{ paddingTop: insets.top }}>
      <StatusBar style="dark" />
      <View className="h-14 justify-center">
        <BackButton progress={null} />
      </View>
      {loaded.state === "loading" ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : (
        <View className="flex-1 justify-center gap-2 px-1 pb-24">
          <Text className="text-heading font-semibold">
            {loaded.state === "missing" ? "This venue isn’t on Hagz" : "Couldn’t load the venue"}
          </Text>
          <Text className="text-subtitle text-ink-2">
            {loaded.state === "missing"
              ? "It may have closed, or the link is wrong."
              : loaded.state === "failed"
                ? loaded.message
                : ""}
          </Text>
          {loaded.state === "failed" ? (
            <View className="mt-4 items-start">
              <Button label="Try again" onPress={onRetry} />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

// The round back button: white over the photo, the usual grey once the bar is behind it.
function BackButton({ progress }: { progress: SharedValue<number> | null }) {
  const style = useAnimatedStyle(() => ({
    backgroundColor: progress
      ? interpolateColor(progress.value, [0, 1], ["#ffffff", "#f2f3f5"])
      : "#f2f3f5",
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={8}
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
      className="active:opacity-70"
    >
      <Animated.View className="size-10 items-center justify-center rounded-full" style={style}>
        <IconChevronLeft size={20} color={colors.ink} strokeWidth={2} />
      </Animated.View>
    </Pressable>
  );
}

function Photos({ venue }: { venue: PublicVenue }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  if (venue.photos.length === 0) {
    return <View className="bg-[#c4c8cf]" style={{ height: PHOTO_HEIGHT }} />;
  }
  return (
    <View style={{ height: PHOTO_HEIGHT }}>
      <FlatList
        data={venue.photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(photo) => photo.id}
        onMomentumScrollEnd={(event) =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item }) => (
          <Image
            source={{ uri: reachable(item.url) }}
            style={{ width, height: PHOTO_HEIGHT, backgroundColor: "#c4c8cf" }}
            contentFit="cover"
            transition={150}
            accessibilityLabel={`Photo of ${venue.name ?? "the venue"}`}
          />
        )}
      />
      {venue.photos.length > 1 ? (
        <View className="absolute right-4 bottom-4 h-[26px] justify-center rounded-full bg-[#000000a0] px-2.5">
          <Text className="text-caption font-medium text-white">
            {index + 1} / {venue.photos.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Tabs({
  tabs,
  active,
  onPress,
}: {
  tabs: Tab[];
  active: Tab;
  onPress: (tab: Tab) => void;
}) {
  return (
    <View className="border-b border-border bg-white" style={{ height: TABS }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-[22px] px-6"
      >
        {tabs.map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === active }}
            onPress={() => onPress(tab)}
            className={`justify-center border-b-2 ${tab === active ? "border-ink" : "border-transparent"}`}
            style={{ height: TABS }}
          >
            <Text className={`text-body font-medium ${tab === active ? "text-ink" : "text-unit"}`}>
              {TAB_LABELS[tab]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function VenueView({
  venue,
  availability,
}: {
  venue: PublicVenue;
  availability: VenueAvailability | null;
}) {
  const insets = useSafeAreaInsets();
  const hud = useHud();
  const scroll = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const header = insets.top + BAR;

  const tabs: Tab[] = [
    "grounds",
    "booking",
    ...(venue.amenities.length > 0 ? (["amenities"] as const) : []),
    "reviews",
    "map",
  ];
  // Where each section and the tabs start in the scroll, from their layouts.
  const offsets = useRef<Partial<Record<Tab, number>>>({});
  const [tabsAt, setTabsAt] = useState(Number.POSITIVE_INFINITY);
  const [active, setActive] = useState<Tab>("grounds");
  const [darkStatus, setDarkStatus] = useState(false);
  const recordOffset = (tab: Tab) => (event: { nativeEvent: { layout: { y: number } } }) => {
    offsets.current[tab] = event.nativeEvent.layout.y;
  };

  // The bottom bar: the HUD sits just above it.
  const [footer, setFooter] = useState(0);
  useHudAnchor(footer);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // 0 over the photo, 1 once the bar is fully in.
  const barProgress = useSharedValue(0);
  useAnimatedReaction(
    () =>
      interpolate(
        scrollY.value,
        [PHOTO_HEIGHT - header - 60, PHOTO_HEIGHT - header],
        [0, 1],
        "clamp",
      ),
    (value) => {
      barProgress.value = value;
    },
  );
  useAnimatedReaction(
    () => barProgress.value > 0.5,
    (dark, previous) => {
      if (dark !== previous) runOnJS(setDarkStatus)(dark);
    },
  );
  // The tabs stick under the bar once they reach it.
  const [stuck, setStuck] = useState(false);
  useAnimatedReaction(
    () => scrollY.value >= tabsAt - header,
    (now, previous) => {
      if (now !== previous) runOnJS(setStuck)(now);
    },
    [tabsAt, header],
  );
  const barStyle = useAnimatedStyle(() => ({ opacity: barProgress.value }));

  // Which section is under the stuck tabs.
  const pickActive = (y: number) => {
    let current: Tab = tabs[0] ?? "grounds";
    for (const tab of tabs) {
      const at = offsets.current[tab];
      if (at !== undefined && y + header + TABS + 24 >= at) current = tab;
    }
    setActive((previous) => (previous === current ? previous : current));
  };
  useAnimatedReaction(
    () => Math.round(scrollY.value / 8),
    (step, previous) => {
      if (step !== previous) runOnJS(pickActive)(scrollY.value);
    },
  );

  const goTo = (tab: Tab) => {
    const at = offsets.current[tab];
    if (at === undefined) return;
    scroll.current?.scrollTo({ y: Math.max(0, at - header - TABS + 1), animated: true });
    setActive(tab);
  };

  const soon = () => hud.show("Booking opens soon");
  const cheapest = cheapestHour(venue);
  const paused = venue.status === "MAINTENANCE";

  return (
    <View className="flex-1 bg-white">
      <StatusBar style={darkStatus ? "dark" : "light"} />
      <Animated.ScrollView
        ref={scroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: footer + 32 }}
      >
        <Photos venue={venue} />
        <VenueHeader venue={venue} />
        <Figures venue={venue} />
        <FreeToday venue={venue} availability={availability} onPick={soon} />
        <View className="mt-8" onLayout={(event) => setTabsAt(event.nativeEvent.layout.y)}>
          <Tabs tabs={tabs} active={active} onPress={goTo} />
        </View>
        <GroundsSection venue={venue} onLayout={recordOffset("grounds")} />
        <BookingSection venue={venue} onLayout={recordOffset("booking")} />
        {venue.amenities.length > 0 ? (
          <AmenitiesSection venue={venue} onLayout={recordOffset("amenities")} />
        ) : null}
        {venue.description ? <AboutSection description={venue.description} /> : null}
        <ReviewsSection venue={venue} onLayout={recordOffset("reviews")} />
        <WhereSection venue={venue} onLayout={recordOffset("map")} />
      </Animated.ScrollView>

      {/* The bar over the top: white behind the back button once the photo has gone, then the
          tabs under it. */}
      <View className="absolute top-0 right-0 left-0" pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          className="absolute top-0 right-0 left-0 bg-white"
          style={[{ height: header }, barStyle]}
        />
        <View
          className="flex-row items-center px-5"
          style={{ paddingTop: insets.top, height: header }}
          pointerEvents="box-none"
        >
          <BackButton progress={barProgress} />
        </View>
        {stuck ? <Tabs tabs={tabs} active={active} onPress={goTo} /> : null}
      </View>

      <View
        className="absolute right-0 bottom-0 left-0 flex-row items-center justify-between gap-4 border-t border-border bg-white px-5 pt-3.5"
        style={{ paddingBottom: insets.bottom + 8 }}
        onLayout={(event) => setFooter(event.nativeEvent.layout.height)}
      >
        <View className="shrink gap-0.5">
          <Text className="text-button font-medium">
            {cheapest === null
              ? "Prices vary"
              : `from ${formatPrice(cheapest, venue.marketplace.currency)}`}
          </Text>
          <Text className="text-caption text-unit">
            per hour · {paymentLabel(venue.booking.payment).toLowerCase()}
          </Text>
        </View>
        <View className="w-[150px]">
          <Button
            label={paused ? "Paused" : "Book"}
            variant="moment"
            disabled={paused}
            onPress={soon}
          />
        </View>
      </View>
    </View>
  );
}
