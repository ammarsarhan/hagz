import type { components } from "@hagz/api";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import Animated, { FadeOut, LinearTransition } from "react-native-reanimated";
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
import { sportsText } from "@/lib/search";

type Favorite = components["schemas"]["FavoriteVenue"];
type Loaded = { state: "loading" } | { state: "failed"; message: string } | { state: "ready" };

// The saved heart's deeper red edge, as on the venue page.
const SAVED_EDGE = "#b42318";

// Favorites (Figma C7, 156:2 and 158:2; the user, 2026-11-20), opened from the Account tab: the
// venues the player saved, newest first, as Search's cards with the red heart on the cover to take
// one off (it leaves the list at once). A venue that's gone from Hagz stays, faded, with Remove. Read
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

  return (
    <Screen>
      {/* The whole page scrolls, the back button with it; edge to edge, gutters put back inside. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
      >
        <View className="-mx-1">{nav}</View>
        <Title subtitle={t("screens.favorites.count", { count: shown.length })}>
          {t("screens.favorites.title")}
        </Title>
        {shown.map((venue, index) => (
          <Animated.View
            key={venue.id}
            layout={LinearTransition.duration(240)}
            exiting={FadeOut.duration(180)}
          >
            {index > 0 ? <View className="my-6 h-px bg-border" /> : null}
            <FavoriteCard venue={venue} />
          </Animated.View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Rating({ venue }: { venue: Favorite }) {
  if (venue.rating.average === null) return null;
  return (
    <View className="flex-row items-center gap-1">
      <IconStarFilled size={14} color={colors.ink} />
      <Text className="text-body font-medium">{venue.rating.average.toFixed(2)}</Text>
      <Text className="text-body text-ink-2">({venue.rating.count})</Text>
    </View>
  );
}

// A saved venue: its cover with the red heart (tap to take it off), then the venue. Gone from Hagz:
// faded, with Remove for the heart, and nothing to open.
function FavoriteCard({ venue }: { venue: Favorite }) {
  const { t } = useTranslation();
  const hud = useHud();
  const gone = venue.status === "UNAVAILABLE";
  const name = venue.name ?? t("screens.venue.fallbackName");
  const remove = () =>
    void toggleFavorite(venue.id).then((problem) => {
      if (problem) hud.show(problem);
    });
  const line = gone
    ? t("screens.favorites.gone")
    : venue.status === "MAINTENANCE"
      ? t("screens.favorites.paused")
      : [venue.area, sportsText(venue.sports)].filter(Boolean).join(" · ");

  return (
    <Pressable
      accessibilityRole={gone ? undefined : "button"}
      disabled={gone}
      onPress={() => router.push({ pathname: "/venue/[slug]", params: { slug: venue.slug } })}
    >
      <View
        className="overflow-hidden rounded-2xl bg-[#c4c8cf]"
        style={{ aspectRatio: 16 / 9, opacity: gone ? 0.45 : 1 }}
      >
        {venue.cover ? (
          <Image
            source={{ uri: reachable(venue.cover.url) }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
          />
        ) : null}
        {gone ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("screens.favorites.unsave", { name })}
            hitSlop={8}
            onPress={remove}
            className="absolute top-3 right-3 size-9 items-center justify-center rounded-full bg-white active:opacity-80"
          >
            <View>
              <IconHeartFilled size={18} color={colors.red} />
              <View className="absolute inset-0">
                <IconHeart size={18} color={SAVED_EDGE} strokeWidth={2} />
              </View>
            </View>
          </Pressable>
        )}
      </View>
      <View className="mt-4 flex-row items-center justify-between gap-3">
        <Text
          className={`shrink text-[18px] leading-6 font-medium ${gone ? "text-ink-3" : ""}`}
          numberOfLines={1}
        >
          {name}
        </Text>
        {gone ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={remove}>
            <Text className="text-body font-medium underline">{t("screens.favorites.remove")}</Text>
          </Pressable>
        ) : (
          <Rating venue={venue} />
        )}
      </View>
      <Text className="mt-1 text-body text-ink-2" numberOfLines={1}>
        {line}
      </Text>
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
