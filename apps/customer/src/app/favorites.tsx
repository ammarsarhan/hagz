import type { components } from "@hagz/api";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, useWindowDimensions, View } from "react-native";
import Animated, {
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { useHud } from "@/components/hud";
import { IconHeart, IconHeartFilled, IconStarFilled } from "@/components/icons";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api, reachable } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { syncFavorites, toggleFavorite, useFavoriteIds } from "@/lib/favorites";
import { isRTL } from "@/lib/language";
import { sportsText } from "@/lib/search";

type Favorite = components["schemas"]["FavoriteVenue"];
type Loaded = { state: "loading" } | { state: "failed"; message: string } | { state: "ready" };

// The saved heart's deeper red edge, as on the venue page.
const SAVED_EDGE = "#b42318";

// Favorites (Figma C7, 157:2 and 158:2; the user, 2026-11-20), opened from the Account tab: the
// venues the player saved, newest first, as rows with the red heart at the end to take one off (it
// leaves the list at once). A venue that's gone from Hagz stays, faded, with Remove. Read
// fresh each time the screen comes into view, and every heart in the app follows it.
export default function Favorites() {
  const { t } = useTranslation();
  const [venues, setVenues] = useState<Favorite[]>([]);
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const saved = useFavoriteIds();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const result = await send(api.GET("/v1/customers/me/favorites"));
        if (!active) return;
        if (!result.ok) {
          setLoaded({ state: "failed", message: hudMessage(result.error) });
          return;
        }
        setVenues(result.data.data);
        syncFavorites(result.data.data.map((venue) => venue.id));
        setLoaded({ state: "ready" });
      })();
      return () => {
        active = false;
      };
    }, [attempt]),
  );

  const shown = venues.filter((venue) => saved.has(venue.id));
  const nav = <NavBar start={<BackButton onPress={() => router.back()} />} />;

  if (loaded.state !== "ready") {
    return (
      <Screen
        footer={
          loaded.state === "failed" ? (
            <Button
              label={t("common.actions.tryAgain")}
              onPress={() => {
                setLoaded({ state: "loading" });
                setAttempt((n) => n + 1);
              }}
            />
          ) : undefined
        }
      >
        {nav}
        <Title>{t("screens.favorites.title")}</Title>
        {loaded.state === "loading" ? (
          <View className="flex-1 items-center justify-center pb-24">
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : (
          <Text className="text-subtitle text-ink-2">{loaded.message}</Text>
        )}
      </Screen>
    );
  }

  if (shown.length === 0) return <Empty nav={nav} />;

  return <List venues={shown} />;
}

// The back button's row (NavBar's h-10, at the top of the safe area) and the gap under it to the
// title (its mb-[22px]), as on every Screen; the bar keeps 8 more under the button.
const ROW = 40;
const BAR_BELOW = 8;
const TITLE_GAP = 22;
// The compact title fades in over the last stretch of the big one going under the bar, rising.
const FADE = 24;
const RISE = 6;

// The list scrolls as one page under a fixed bar, the venue page's and the staff app's pattern
// (user, 2026-11-20): the big title goes under the bar and comes back small beside the back button,
// and the bar's hairline fades in once anything is under it.
function List({ venues }: { venues: Favorite[] }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bar = insets.top + ROW + BAR_BELOW;
  const scrollY = useSharedValue(0);
  const titleEnd = useSharedValue(Number.POSITIVE_INFINITY);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const compact = useAnimatedStyle(() => {
    const gone = titleEnd.value - bar;
    const progress = interpolate(scrollY.value, [gone - FADE, gone], [0, 1], "clamp");
    return { opacity: progress, transform: [{ translateY: (1 - progress) * RISE }] };
  });
  const hairline = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 12], [0, 1], "clamp"),
  }));
  const title = t("screens.favorites.title");

  return (
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <StatusBar style="dark" />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + ROW + TITLE_GAP,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 32,
        }}
      >
        <Title
          subtitle={t("screens.favorites.subtitle")}
          onTitleLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            titleEnd.value = y + height;
          }}
        >
          {title}
        </Title>
        {venues.map((venue, index) => (
          <Animated.View
            key={venue.id}
            layout={LinearTransition.duration(240)}
            exiting={FadeOut.duration(180)}
            // With more than one, the list starts a little closer to the subtitle (user, 2026-11-20).
            style={index === 0 && venues.length > 1 ? { marginTop: -10 } : undefined}
          >
            {index > 0 ? <View className="h-px bg-border" /> : null}
            <FavoriteRow venue={venue} />
          </Animated.View>
        ))}
        {/* How many, at the end of the list (user, 2026-11-20), quiet like Account's version line;
            it slides up with the rows when one is taken off. */}
        <Animated.View layout={LinearTransition.duration(240)}>
          <Text className="mt-5 text-center text-caption text-ink-3">
            {t("screens.favorites.count", { count: venues.length })}
          </Text>
        </Animated.View>
      </Animated.ScrollView>

      <View
        className="absolute top-0 right-0 left-0 bg-white px-5"
        style={{ height: bar, paddingTop: insets.top }}
      >
        <View className="-mx-1 h-10 flex-row items-center gap-3">
          <BackButton onPress={() => router.back()} />
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            // The gutters, the button and the gap: a long title ends in "…".
            style={[compact, { maxWidth: width - 40 - 40 - 12 }]}
          >
            <Text className="text-body leading-[1.25] font-semibold" numberOfLines={1}>
              {title}
            </Text>
          </Animated.View>
        </View>
        <Animated.View
          className="absolute right-0 bottom-0 left-0 h-px bg-hairline"
          style={hairline}
        />
      </View>
    </View>
  );
}

// A saved venue as a row (Figma C7, 157:2; the user's pick, 2026-11-20): its photo, then the name,
// where it is, and what's played there with its rating; the red heart at the end takes it off. Gone
// from Hagz: faded, with Remove for the heart, and nothing to open.
const THUMB = 84;

function FavoriteRow({ venue }: { venue: Favorite }) {
  const { t } = useTranslation();
  const hud = useHud();
  const gone = venue.status === "UNAVAILABLE";
  const name = venue.name ?? t("screens.venue.fallbackName");
  const remove = () =>
    void toggleFavorite(venue.id).then((problem) => {
      if (problem) hud.show(problem);
    });
  const where = gone
    ? t("screens.favorites.gone")
    : venue.status === "MAINTENANCE"
      ? t("screens.favorites.paused")
      : venue.area;
  const rating = venue.rating.average;

  return (
    <Pressable
      accessibilityRole={gone ? undefined : "button"}
      disabled={gone}
      onPress={() => router.push({ pathname: "/venue/[slug]", params: { slug: venue.slug } })}
      className="flex-row items-center gap-3.5 py-3.5"
    >
      <View
        className="overflow-hidden rounded-[14px]"
        style={{ width: THUMB, height: THUMB, backgroundColor: "#c4c8cf", opacity: gone ? 0.4 : 1 }}
      >
        {venue.cover ? (
          <Image
            source={{ uri: reachable(venue.cover.url) }}
            style={{ width: THUMB, height: THUMB }}
            contentFit="cover"
            transition={150}
          />
        ) : null}
      </View>
      <View className="flex-1" style={{ opacity: gone ? 0.5 : 1 }}>
        <Text className="text-[17px] leading-[22px] font-medium" numberOfLines={1}>
          {name}
        </Text>
        {where ? (
          <Text className="mt-0.5 text-label text-ink-2" numberOfLines={1}>
            {where}
          </Text>
        ) : null}
        <View className="flex-row items-center gap-1">
          <Text className="shrink text-label text-ink-2" numberOfLines={1}>
            {sportsText(venue.sports)}
          </Text>
          {rating !== null && !gone ? (
            <>
              <Text className="text-label text-ink-2">·</Text>
              <IconStarFilled size={12} color={colors.ink2} />
              <Text className="text-label text-ink-2">{rating.toFixed(2)}</Text>
            </>
          ) : null}
        </View>
      </View>
      {gone ? (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={remove}>
          <Text className="text-label font-medium underline">{t("screens.favorites.remove")}</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("screens.favorites.unsave", { name })}
          hitSlop={12}
          onPress={remove}
          className="active:opacity-60"
        >
          <View>
            <IconHeartFilled size={20} color={colors.red} />
            <View className="absolute inset-0">
              <IconHeart size={20} color={SAVED_EDGE} strokeWidth={2} />
            </View>
          </View>
        </Pressable>
      )}
    </Pressable>
  );
}

// Nothing saved: what the heart does, and the way to Search.
function Empty({ nav }: { nav: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Screen>
      {nav}
      <Title>{t("screens.favorites.title")}</Title>
      <View className="flex-1 items-center justify-center px-5 pb-32">
        <View className="size-[120px] items-center justify-center rounded-full bg-[#0b0b0c12]">
          <IconHeart size={48} color={colors.ink} strokeWidth={1.5} />
        </View>
        <Text className="mt-6 text-center text-heading font-semibold">
          {t("screens.favorites.empty.title")}
        </Text>
        <Text className="mt-2 text-center text-subtitle text-ink-2">
          {t("screens.favorites.empty.body")}
        </Text>
        <View className="mt-6">
          <Button
            label={t("screens.favorites.empty.action")}
            size="small"
            onPress={() => router.navigate("/search")}
          />
        </View>
      </View>
    </Screen>
  );
}
