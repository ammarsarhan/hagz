import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { Button } from "@/components/button";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { VenueLayout } from "@/components/venue-layout";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import type { PublicVenue } from "@/lib/venue";

type Loaded =
  | { state: "loading" }
  | { state: "failed"; message: string }
  | { state: "ready"; venue: PublicVenue };

// A venue's layout on its own screen, from View layout on the Grounds heading (user, 2026-11-22):
// the map from above, where tapping an open ground opens its See times. Opened from a search, it
// carries the search's day, start and length on to See times, as the ground cards do, and fades the
// grounds the search left out.
export default function VenueLayoutScreen() {
  const { t } = useTranslation();
  const { slug, unavailable, ...search } = useLocalSearchParams<{
    slug: string;
    unavailable?: string;
    date?: string;
    start?: string;
    hours?: string;
  }>();
  const unavailableIds = useMemo(
    () => (unavailable ? new Set(unavailable.split(",")) : undefined),
    [unavailable],
  );
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void send(api.GET("/v1/venues/{slug}", { params: { path: { slug } } })).then((result) => {
      if (!active) return;
      setLoaded(
        result.ok
          ? { state: "ready", venue: result.data }
          : { state: "failed", message: hudMessage(result.error) },
      );
    });
    return () => {
      active = false;
    };
  }, [slug, attempt]);

  const openTimes = (groundId: string) =>
    router.push({
      pathname: "/venue/[slug]/times",
      params: {
        slug,
        ground: groundId,
        ...(search.date ? { date: search.date } : {}),
        ...(search.start ? { start: search.start, hours: search.hours ?? "1" } : {}),
      },
    });

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
      <NavBar start={<BackButton onPress={() => router.back()} />} />
      {loaded.state === "loading" ? (
        <View className="flex-1 items-center justify-center pb-24">
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : loaded.state === "failed" ? (
        <>
          <Title>{t("screens.layout.title")}</Title>
          <Text className="text-subtitle text-ink-2">{loaded.message}</Text>
        </>
      ) : (
        // A tall venue scrolls, its scroll bar at the screen's edge rather than the gutter.
        <ScrollView className="-mx-5" contentContainerClassName="px-5 pb-8">
          <Title subtitle={t("screens.layout.subtitle")}>{t("screens.layout.title")}</Title>
          {loaded.venue.layout ? (
            <VenueLayout
              layout={loaded.venue.layout}
              grounds={loaded.venue.grounds}
              amenities={loaded.venue.amenities}
              unavailableIds={unavailableIds}
              onPressGround={openTimes}
            />
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
