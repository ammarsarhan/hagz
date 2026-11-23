import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Share,
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
import { IconChevronLeft, IconHeart, IconHeartFilled, IconShare } from "@/components/icons";
import { toggleFavorite, useIsFavorite } from "@/lib/favorites";
import { PageState } from "@/components/page-state";
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
import { problem, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { useDistanceTo } from "@/lib/distance";
import {
  describeFilter,
  groundFilterOf,
  matchingGrounds,
  type GroundFilter,
} from "@/lib/ground-filter";
import { isRTL, language } from "@/lib/language";
import { webLinks } from "@/lib/links";
import { fromPerHour } from "@/lib/money";
import { cheapestHour, nextDate, paymentShort, type PublicVenue } from "@/lib/venue";
import { push } from "@/lib/navigation";

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
  | { state: "failed"; error: unknown }
  | { state: "ready"; venue: PublicVenue };

export default function VenuePage() {
  const { slug, ...rest } = useLocalSearchParams<{ slug: string } & Record<string, string>>();
  // Opened from a search: what it asked of the grounds (lib/ground-filter.ts). Kept by value.
  const restKey = JSON.stringify(rest);
  const filter = useMemo(
    () => groundFilterOf(JSON.parse(restKey) as Record<string, string>),
    [restKey],
  );
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      const venue = await send(api.GET("/v1/venues/{slug}", { params: { path: { slug } } }));
      if (!active) return;
      if (venue.ok) setLoaded({ state: "ready", venue: venue.data });
      else if (problem(venue.error)?.code === "VENUE_NOT_FOUND") setLoaded({ state: "missing" });
      else setLoaded({ state: "failed", error: venue.error });
    })();
    return () => {
      active = false;
    };
  }, [slug, attempt]);

  if (loaded.state === "ready") return <VenueView venue={loaded.venue} filter={filter} />;
  if (loaded.state === "failed") {
    return (
      <PageState
        error={loaded.error}
        onRetry={() => {
          setLoaded({ state: "loading" });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  return <Waiting missing={loaded.state === "missing"} />;
}

// Loading, or a venue that isn't public (or never was). One that couldn't be read is PageState's.
function Waiting({ missing }: { missing: boolean }) {
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
      {!missing ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : (
        <View className="flex-1 justify-center gap-2 px-1 pb-24">
          <Text className="text-heading font-semibold">{t("screens.venue.missingTitle")}</Text>
          <Text className="text-subtitle text-ink-2">{t("screens.venue.missingBody")}</Text>
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

// Pulled down past the top (iOS's bounce), the photo stays pinned to the screen's top edge and
// zooms by half as much as it's pulled, while the page under it pulls away: a white band opens
// between the photo and the venue's name (user, 2026-11-20, over a full Airbnb stretch, which
// zoomed too far). The counter rides on the photo's bottom edge, unzoomed.
const ZOOM = 0.5;

function Photos({ venue, scrollY }: { venue: PublicVenue; scrollY: SharedValue<number> }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  // Pulled `p` down, the page (and this box) sits `p` lower. The photo goes back up by `p` to the
  // screen's top, then grows by ZOOM·p from that top edge (a scale grows from the middle, so it
  // comes down by half of that again).
  const stretch = useAnimatedStyle(() => {
    const pulled = Math.max(0, -scrollY.value);
    const grown = ZOOM * pulled;
    return {
      transform: [
        { translateY: -pulled + grown / 2 },
        { scale: (PHOTO_HEIGHT + grown) / PHOTO_HEIGHT },
      ],
    };
  });
  // The photo's bottom edge ends up (1 − ZOOM)·p above where the box's is.
  const counter = useAnimatedStyle(() => ({
    transform: [{ translateY: -(1 - ZOOM) * Math.max(0, -scrollY.value) }],
  }));
  if (venue.photos.length === 0) {
    return <Animated.View className="bg-[#c4c8cf]" style={[{ height: PHOTO_HEIGHT }, stretch]} />;
  }
  return (
    <View style={{ height: PHOTO_HEIGHT }}>
      <Animated.View style={stretch}>
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
      </Animated.View>
      {venue.photos.length > 1 ? (
        <Animated.View
          className="absolute right-4 bottom-4 h-[26px] justify-center rounded-full bg-[#000000a0] px-2.5"
          style={counter}
        >
          <Text className="text-caption font-medium text-white">
            {t("screens.venue.photoCount", { index: index + 1, count: venue.photos.length })}
          </Text>
        </Animated.View>
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

// A search's grounds on this venue: the day's free slots read (and the next day's, for a game that
// runs past midnight), then each ground judged as the search judges it. Null without a search, or
// until the slots are back (nothing is greyed out before it's known).
function useSearchedGrounds(venue: PublicVenue, filter: GroundFilter | null) {
  const [searched, setSearched] = useState<{
    date: string;
    matches: ReadonlySet<string>;
    note: string;
  } | null>(null);
  useEffect(() => {
    if (!filter) return;
    let active = true;
    void (async () => {
      const read = (date?: string) =>
        send(
          api.GET("/v1/venues/{slug}/availability", {
            params: { path: { slug: venue.slug }, query: date ? { date } : {} },
          }),
        );
      const day = await read(filter.date);
      if (!active || !day.ok) return;
      const { date, timezone, currency, days } = day.data;
      const next = date < days.last ? await read(nextDate(date)) : null;
      if (!active) return;
      const slots = [...day.data.slots, ...(next?.ok === true ? next.data.slots : [])];
      setSearched({
        date,
        matches: matchingGrounds(venue.grounds, slots, filter, date, timezone),
        note: describeFilter(filter, date, timezone, currency),
      });
    })();
    return () => {
      active = false;
    };
  }, [venue, filter]);
  return searched;
}

function VenueView({ venue, filter }: { venue: PublicVenue; filter: GroundFilter | null }) {
  const { t } = useTranslation();
  const searched = useSearchedGrounds(venue, filter);
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

  // Null in a build without the web app's address: no Share then. In the app's language, so an
  // Arabic phone shares the Arabic page.
  const link = webLinks?.venue(venue.slug, language) ?? null;
  const distance = useDistanceTo(venue.location.coordinates);
  const cheapest = cheapestHour(venue);
  const paused = venue.status === "MAINTENANCE";
  // The ground picked in the row under the map (the first open one to begin with): Book opens its
  // free hours, as its own See times does.
  const pickedGround = useRef(
    venue.grounds.find((ground) => ground.status === "ACTIVE")?.id ?? venue.grounds[0]?.id,
  );
  // See times opens on the search's day, with its start and length picked when there was one.
  const searchParams = {
    ...(searched ? { date: searched.date } : {}),
    ...(filter?.start ? { start: filter.start, hours: String(filter.hours) } : {}),
  };
  const openTimes = (groundId: string | undefined) => {
    if (!groundId) return;
    push({
      pathname: "/venue/[slug]/times",
      params: { slug: venue.slug, ground: groundId, ...searchParams },
    });
  };
  // The layout on its own screen, which opens See times the same way, fades the grounds the search
  // left out, and has what was searched for as its subtitle.
  const openLayout = () => {
    const matches = searched?.matches;
    const unavailable = matches
      ? venue.grounds.filter((ground) => !matches.has(ground.id)).map((ground) => ground.id)
      : [];
    push({
      pathname: "/venue/[slug]/layout",
      params: {
        slug: venue.slug,
        ...searchParams,
        ...(searched ? { note: searched.note } : {}),
        ...(unavailable.length > 0 ? { unavailable: unavailable.join(",") } : {}),
      },
    });
  };

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
        <Photos venue={venue} scrollY={scrollY} />
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
          onSeeTimes={openTimes}
          onViewLayout={openLayout}
          onPick={(groundId) => {
            pickedGround.current = groundId;
          }}
          matches={searched?.matches ?? null}
          note={searched?.note}
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
                // The system's share sheet: send it in a chat, copy it, post it.
                onPress={() =>
                  void Share.share({
                    message: t("screens.venue.shareMessage", {
                      venue: venue.name ?? t("screens.venue.fallbackName"),
                      link,
                    }),
                  })
                }
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
        className="absolute right-0 bottom-0 left-0 flex-row items-center justify-between gap-6 border-t border-border bg-white pt-3.5"
        // Book closer to the edge than the price is (user, 2026-11-22); start and end, for Arabic.
        style={{ paddingStart: 24, paddingEnd: 16, paddingBottom: insets.bottom + 8 }}
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
            onPress={() => openTimes(pickedGround.current)}
          />
        </View>
      </View>
    </View>
  );
}
