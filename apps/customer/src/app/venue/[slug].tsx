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
  type LayoutChangeEvent,
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
  CancellationSection,
  GroundsSection,
  Highlights,
  ReviewsSection,
  VenueHeader,
  WhereSection,
} from "@/components/venue-sections";
import { api, reachable } from "@/lib/api";
import { hudMessage, problem, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { formatAmount } from "@/lib/money";
import { cheapestHour, paymentShort, type PublicVenue } from "@/lib/venue";

// The venue page (Figma C5, frames 59:2 and 60:2; PR 3.2): photos edge to edge under the status
// bar, then the venue and every section a player checks before booking, with Book pinned to the
// bottom. Public, so guests see all of it.
//
// As the photos scroll away a white bar fades in behind the back button, and the venue's name rises
// into it beside the button as the big name goes under (the staff app's compact title). The tabs
// stick under the bar the moment they reach it: they're moved on the UI thread with the scroll, so
// they never lag behind it. Booking itself (the day and time sheet, the ground picker) comes next,
// so Book says so for now.

const PHOTO_HEIGHT = 320;
const BAR = 56;
const TABS = 46;
// The compact name fades in over the last stretch of the big one going under the bar, rising as it
// does.
const FADE = 24;
const RISE = 6;

type Tab = "grounds" | "booking" | "amenities" | "reviews" | "map";
const TAB_LABELS: Record<Tab, string> = {
  grounds: "Grounds",
  booking: "Booking",
  amenities: "Amenities",
  reviews: "Reviews",
  map: "Map",
};

type Loaded =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "failed"; message: string }
  | { state: "ready"; venue: PublicVenue };

export default function VenuePage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      const venue = await send(api.GET("/v1/venues/{slug}", { params: { path: { slug } } }));
      if (!active) return;
      if (venue.ok) setLoaded({ state: "ready", venue: venue.data });
      else if (problem(venue.error)?.code === "VENUE_NOT_FOUND") setLoaded({ state: "missing" });
      else setLoaded({ state: "failed", message: hudMessage(venue.error) });
    })();
    return () => {
      active = false;
    };
  }, [slug, attempt]);

  if (loaded.state === "ready") return <VenueView venue={loaded.venue} />;
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

function VenueView({ venue }: { venue: PublicVenue }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
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
  // Where each section starts in the scroll, from their layouts.
  const offsets = useRef<Partial<Record<Tab, number>>>({});
  const [active, setActive] = useState<Tab>("grounds");
  const [darkStatus, setDarkStatus] = useState(false);
  const recordOffset = (tab: Tab) => (event: LayoutChangeEvent) => {
    offsets.current[tab] = event.nativeEvent.layout.y;
  };

  // Where the tabs sit in the scroll, and where the big name ends, both on the UI thread.
  const tabsAt = useSharedValue(Number.POSITIVE_INFINITY);
  const titleEnd = useSharedValue(Number.POSITIVE_INFINITY);

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
  const barStyle = useAnimatedStyle(() => ({ opacity: barProgress.value }));
  const compactStyle = useAnimatedStyle(() => {
    const gone = titleEnd.value - header;
    const progress = interpolate(scrollY.value, [gone - FADE, gone], [0, 1], "clamp");
    return { opacity: progress, transform: [{ translateY: (1 - progress) * RISE }] };
  });
  // Pinned under the bar: once the tabs reach it, they move down with the scroll by as much as
  // they'd otherwise go up.
  const stickStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, scrollY.value - (tabsAt.value - header)) }],
  }));

  // Which section is under the tabs.
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
        <VenueHeader
          venue={venue}
          onTitleLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            titleEnd.value = PHOTO_HEIGHT + y + height;
          }}
        />
        <Highlights venue={venue} />
        <Animated.View
          className="mt-8"
          style={[{ zIndex: 10 }, stickStyle]}
          onLayout={(event) => {
            tabsAt.value = event.nativeEvent.layout.y;
          }}
        >
          <Tabs tabs={tabs} active={active} onPress={goTo} />
        </Animated.View>
        <GroundsSection venue={venue} onLayout={recordOffset("grounds")} />
        <BookingSection venue={venue} onLayout={recordOffset("booking")} />
        <CancellationSection venue={venue} />
        {venue.amenities.length > 0 ? (
          <AmenitiesSection venue={venue} onLayout={recordOffset("amenities")} />
        ) : null}
        {venue.description ? <AboutSection description={venue.description} /> : null}
        <ReviewsSection venue={venue} onLayout={recordOffset("reviews")} />
        <WhereSection venue={venue} onLayout={recordOffset("map")} />
      </Animated.ScrollView>

      {/* The bar over the top: white behind the back button once the photo has gone, with the
          venue's name beside the button once the big one is under it. */}
      <View className="absolute top-0 right-0 left-0" pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          className="absolute top-0 right-0 left-0 bg-white"
          style={[{ height: header }, barStyle]}
        />
        <View
          className="flex-row items-center gap-3 px-5"
          style={{ paddingTop: insets.top, height: header }}
          pointerEvents="box-none"
        >
          <BackButton progress={barProgress} />
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[compactStyle, { maxWidth: width - 40 - 40 - 12 }]}
          >
            <Text className="text-body leading-[1.25] font-semibold" numberOfLines={1}>
              {venue.name ?? ""}
            </Text>
          </Animated.View>
        </View>
      </View>

      <View
        className="absolute right-0 bottom-0 left-0 flex-row items-center justify-between gap-6 border-t border-border bg-white px-6 pt-3.5"
        style={{ paddingBottom: insets.bottom + 8 }}
        onLayout={(event) => setFooter(event.nativeEvent.layout.height)}
      >
        <View className="shrink gap-0.5">
          <Text className="text-button font-medium">
            {cheapest === null
              ? "Prices vary"
              : `from ${formatAmount(cheapest, venue.marketplace.currency)} ${venue.marketplace.currency}/hr`}
          </Text>
          <Text className="text-caption text-unit">{paymentShort(venue.booking.payment)}</Text>
        </View>
        <View className="w-[128px]">
          <Button
            label={paused ? "Paused" : "Book"}
            variant="moment"
            size="small"
            disabled={paused}
            onPress={() => hud.show("Booking opens soon")}
          />
        </View>
      </View>
    </View>
  );
}
