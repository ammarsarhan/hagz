import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { useHud, useHudAnchor } from "@/components/hud";
import {
  IconChevronLeft,
  IconCircleCheckFilled,
  IconHeart,
  IconHeartFilled,
  IconShare,
} from "@/components/icons";
import { toggleFavorite, useIsFavorite } from "@/lib/favorites";
import { useSignInSheet } from "@/components/sign-in-sheet";
import type { Icon } from "@tabler/icons-react-native";
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
import { useDistanceTo } from "@/lib/distance";
import { isRTL } from "@/lib/language";
import { webLinks } from "@/lib/links";
import { fromPerHour } from "@/lib/money";
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

// Each tab's label lives under screens.venue.tabs.<tab>.
type Tab = "grounds" | "booking" | "amenities" | "reviews" | "map";

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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 bg-white px-5"
      style={{ paddingTop: insets.top, direction: isRTL ? "rtl" : "ltr" }}
    >
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
            {loaded.state === "missing"
              ? t("screens.venue.missingTitle")
              : t("screens.venue.failedTitle")}
          </Text>
          <Text className="text-subtitle text-ink-2">
            {loaded.state === "missing"
              ? t("screens.venue.missingBody")
              : loaded.state === "failed"
                ? loaded.message
                : ""}
          </Text>
          {loaded.state === "failed" ? (
            <View className="mt-4 items-start">
              <Button label={t("common.actions.tryAgain")} onPress={onRetry} />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

// A round button in the top bar: white over the photo, the usual grey once the bar is behind it.
function BarButton({
  icon: Glyph,
  glyph,
  label,
  onPress,
  progress,
  mirrored = false,
}: {
  icon: Icon;
  // Drawn in place of the icon (the saved heart, red).
  glyph?: ReactNode;
  label: string;
  onPress: () => void;
  progress: SharedValue<number> | null;
  // Flipped in Arabic (the back chevron).
  mirrored?: boolean;
}) {
  const style = useAnimatedStyle(() => ({
    backgroundColor: progress
      ? interpolateColor(progress.value, [0, 1], ["#ffffff", "#f2f3f5"])
      : "#f2f3f5",
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      className="active:opacity-70"
    >
      <Animated.View className="size-10 items-center justify-center rounded-full" style={style}>
        {glyph ?? (
          <Glyph
            size={20}
            color={colors.ink}
            strokeWidth={2}
            style={mirrored ? { transform: [{ scaleX: -1 }] } : undefined}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}

// The heart: filled red once saved (the user's call, 2026-11-20), with a small pop as it fills.
const SAVED_EDGE = "#b42318";
function SaveButton({
  venueId,
  progress,
  onPress,
}: {
  venueId: string;
  progress: SharedValue<number> | null;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const saved = useIsFavorite(venueId);
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (saved)
      scale.value = withSequence(
        withTiming(1.25, { duration: 110 }),
        withTiming(1, { duration: 160 }),
      );
  }, [saved, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={pop}>
      <BarButton
        icon={IconHeart}
        glyph={
          saved ? (
            // Red, with a deeper red edge: the outline drawn over the filled heart.
            <View>
              <IconHeartFilled size={20} color={colors.red} />
              <View className="absolute inset-0">
                <IconHeart size={20} color={SAVED_EDGE} strokeWidth={2} />
              </View>
            </View>
          ) : undefined
        }
        label={saved ? t("screens.venue.unsave") : t("screens.venue.save")}
        progress={progress}
        onPress={onPress}
      />
    </Animated.View>
  );
}

const goBack = () => (router.canGoBack() ? router.back() : router.replace("/home"));

// Points the way back: left in English, right in Arabic.
function BackButton({ progress }: { progress: SharedValue<number> | null }) {
  const { t } = useTranslation();
  return (
    <BarButton
      icon={IconChevronLeft}
      label={t("components.nav.back")}
      onPress={goBack}
      progress={progress}
      mirrored={isRTL}
    />
  );
}

function Photos({ venue }: { venue: PublicVenue }) {
  const { t } = useTranslation();
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
            accessibilityLabel={
              venue.name
                ? t("screens.venue.photoOf", { name: venue.name })
                : t("screens.venue.photoOfVenue")
            }
          />
        )}
      />
      {venue.photos.length > 1 ? (
        <View className="absolute right-4 bottom-4 h-[26px] justify-center rounded-full bg-[#000000a0] px-2.5">
          <Text className="text-caption font-medium text-white">
            {t("screens.venue.photoCount", { index: index + 1, count: venue.photos.length })}
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
  const { t } = useTranslation();
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
              {t(`screens.venue.tabs.${tab}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function VenueView({ venue }: { venue: PublicVenue }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const hud = useHud();
  const { whenSignedIn, sheet } = useSignInSheet(`/venue/${venue.slug}`);
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

  // Where the big name ends, on the UI thread.
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
  // Which section is under the tabs. Not while a tapped tab scrolls to its section: the tabs it
  // passes would light up on the way.
  const jumpingUntil = useRef(0);
  const pickActive = (y: number) => {
    if (Date.now() < jumpingUntil.current) return;
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
    jumpingUntil.current = Date.now() + 600;
    scroll.current?.scrollTo({ y: Math.max(0, at - header - TABS + 1), animated: true });
    setActive(tab);
  };

  // Null in a build without the web app's address: no Share then.
  const link = webLinks?.venue(venue.slug) ?? null;
  const distance = useDistanceTo(venue.location.coordinates);
  const cheapest = cheapestHour(venue);
  const paused = venue.status === "MAINTENANCE";

  return (
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <StatusBar style={darkStatus ? "dark" : "light"} />
      <Animated.ScrollView
        ref={scroll}
        onScroll={onScroll}
        // The tabs (the fourth child) stick natively, so they never trail the scroll.
        stickyHeaderIndices={[3]}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: footer + 32 }}
      >
        <Photos venue={venue} />
        <VenueHeader
          venue={venue}
          distance={distance}
          onTitleLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            titleEnd.value = PHOTO_HEIGHT + y + height;
          }}
        />
        <Highlights venue={venue} />
        {/* A sticky header sticks at the very top, which is under our bar: a clear spacer the bar's
            height goes above the tabs, pulled up over the content before it so the gap stays 32. */}
        <View style={{ marginTop: 32 - header }} pointerEvents="box-none">
          <View style={{ height: header }} pointerEvents="none" />
          <Tabs tabs={tabs} active={active} onPress={goTo} />
        </View>
        <GroundsSection
          venue={venue}
          onLayout={recordOffset("grounds")}
          onSeeTimes={() => hud.show(t("screens.venue.bookingSoon"))}
        />
        <BookingSection venue={venue} onLayout={recordOffset("booking")} />
        <CancellationSection venue={venue} />
        {venue.amenities.length > 0 ? (
          <AmenitiesSection venue={venue} onLayout={recordOffset("amenities")} />
        ) : null}
        {venue.description ? <AboutSection description={venue.description} /> : null}
        <ReviewsSection venue={venue} onLayout={recordOffset("reviews")} />
        <WhereSection venue={venue} distance={distance} onLayout={recordOffset("map")} />
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
          className="flex-row items-center justify-between gap-3 px-5"
          style={{ paddingTop: insets.top, height: header }}
          pointerEvents="box-none"
        >
          <View className="shrink flex-row items-center gap-3" pointerEvents="box-none">
            <BackButton progress={barProgress} />
            <Animated.View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              // The gutters, the three buttons and the gaps: a long name ends in "…".
              style={[compactStyle, { maxWidth: width - 40 - 40 - 12 - 40 - 10 - 40 - 12 }]}
            >
              <Text className="text-body leading-[1.25] font-semibold" numberOfLines={1}>
                {venue.name ?? ""}
              </Text>
            </Animated.View>
          </View>
          <View className="flex-row items-center gap-2.5" pointerEvents="box-none">
            {link ? (
              <BarButton
                icon={IconShare}
                label={t("screens.venue.share")}
                progress={barProgress}
                onPress={() => {
                  // Done, not a problem: a check in place of the HUD's alert.
                  void Clipboard.setStringAsync(link).then(() =>
                    hud.show(t("screens.venue.copied"), {
                      leading: <IconCircleCheckFilled size={22} color={colors.ink} />,
                    }),
                  );
                }}
              />
            ) : null}
            {/* Saving (PR 3.4): a guest is asked to sign in first, as everywhere a choice needs an
                account. */}
            <SaveButton
              venueId={venue.id}
              progress={barProgress}
              onPress={() =>
                void whenSignedIn(
                  () =>
                    void toggleFavorite(venue.id).then((problem) => {
                      if (problem) hud.show(problem);
                    }),
                  {
                    title: t("screens.venue.saveSheet.title"),
                    body: t("screens.venue.saveSheet.body"),
                  },
                )
              }
            />
          </View>
        </View>
      </View>
      {sheet}

      <View
        className="absolute right-0 bottom-0 left-0 flex-row items-center justify-between gap-6 border-t border-border bg-white px-6 pt-3.5"
        style={{ paddingBottom: insets.bottom + 8 }}
        onLayout={(event) => setFooter(event.nativeEvent.layout.height)}
      >
        <View className="shrink gap-0.5">
          <Text className="text-button font-medium">
            {cheapest === null
              ? t("screens.venue.pricesVary")
              : fromPerHour(cheapest, venue.marketplace.currency)}
          </Text>
          <Text className="text-caption text-unit">{paymentShort(venue.booking.payment)}</Text>
        </View>
        <View className="w-[128px]">
          <Button
            label={paused ? t("screens.venue.paused") : t("screens.venue.book")}
            variant="moment"
            size="small"
            disabled={paused}
            onPress={() => hud.show(t("screens.venue.bookingSoon"))}
          />
        </View>
      </View>
    </View>
  );
}
