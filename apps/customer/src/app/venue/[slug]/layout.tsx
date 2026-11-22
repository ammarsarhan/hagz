import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import { Button } from "@/components/button";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { VenueLayout } from "@/components/venue-layout";
import { firstPick, GroundCards } from "@/components/venue-sections";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { formatPrice } from "@/lib/money";
import { kindOf, type PublicVenue } from "@/lib/venue";

type Loaded =
  | { state: "loading" }
  | { state: "failed"; message: string }
  | { state: "ready"; venue: PublicVenue };

// The page's side padding (Screen's px-5), which the cards run into.
const GUTTER = 20;
// From the map to the cards (its mb-5), and kept clear under the cards above the bar.
const MAP_GAP = 20;
const BELOW = 16;

// A venue's layout on its own screen, from View layout on the Grounds heading (Figma C5 215:2,
// round 2; user, 2026-11-22): the map from above, and the venue's ground cards under it. Tapping a
// ground on the map picks it and brings its card into place; swiping the cards picks the one that
// settles. The picked ground is darker on the map and its card has an ink border. The bar at the
// bottom names it, and View times (lime: the user's call over the Figma's black) opens its free
// times. Opened from a search, what was searched for is the subtitle, the grounds that don't fit are
// faded, and the search's day, start and length carry on to See times, as the ground cards do.
export default function VenueLayoutScreen() {
  const { t } = useTranslation();
  const { slug, unavailable, note, ...search } = useLocalSearchParams<{
    slug: string;
    unavailable?: string;
    note?: string;
    date?: string;
    start?: string;
    hours?: string;
  }>();
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
        <NavBar start={<BackButton onPress={() => router.back()} />} />
        {loaded.state === "loading" ? (
          <View className="flex-1 items-center justify-center pb-24">
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : (
          <>
            <Title>{t("screens.layout.title")}</Title>
            <Text className="text-subtitle text-ink-2">{loaded.message}</Text>
          </>
        )}
      </Screen>
    );
  }

  return (
    <Picking
      venue={loaded.venue}
      unavailable={unavailable}
      note={note}
      onTimes={(groundId) =>
        router.push({
          pathname: "/venue/[slug]/times",
          params: {
            slug,
            ground: groundId,
            ...(search.date ? { date: search.date } : {}),
            ...(search.start ? { start: search.start, hours: search.hours ?? "1" } : {}),
          },
        })
      }
    />
  );
}

function Picking({
  venue,
  unavailable,
  note,
  onTimes,
}: {
  venue: PublicVenue;
  // The grounds the search left out, comma-separated; none without a search.
  unavailable?: string;
  // What was searched for ("Fri 22 Nov, 7–9 pm").
  note?: string;
  onTimes: (groundId: string) => void;
}) {
  const { t } = useTranslation();
  const unavailableIds = useMemo(
    () => (unavailable ? new Set(unavailable.split(",")) : undefined),
    [unavailable],
  );
  // The cards take the grounds that fit instead; null without a search.
  const matches = useMemo(
    () =>
      unavailableIds
        ? new Set(
            venue.grounds
              .filter((ground) => !unavailableIds.has(ground.id))
              .map((ground) => ground.id),
          )
        : null,
    [venue, unavailableIds],
  );
  const [pickedId, setPickedId] = useState(() => firstPick(venue.grounds, matches));
  const picked = venue.grounds.find((ground) => ground.id === pickedId);
  const currency = venue.marketplace.currency;
  const open = picked?.status === "ACTIVE";
  // The height under the title, and the cards' (with their dots), for the map to fit between.
  const [room, setRoom] = useState(0);
  const [cardsHeight, setCardsHeight] = useState(0);

  return (
    <Screen
      footer={
        picked ? (
          // Across the screen, under a hairline: the picked ground, and View times.
          <View className="-mx-5 -mt-3 flex-row items-center justify-between gap-6 border-t border-border px-6 pt-3.5">
            <View className="shrink gap-0.5">
              <Text className="text-button font-medium" numberOfLines={1}>
                {picked.name ?? kindOf(picked)}
              </Text>
              <Text className="text-caption text-unit" numberOfLines={1}>
                {!open
                  ? t("screens.venue.grounds.closed")
                  : picked.priceFrom === null
                    ? kindOf(picked)
                    : `${formatPrice(picked.priceFrom, currency)}${t("formats.perHour")} · ${kindOf(picked)}`}
              </Text>
            </View>
            <View className="w-[150px]">
              <Button
                label={t("screens.layout.viewTimes")}
                variant="moment"
                size="small"
                disabled={!open}
                onPress={() => onTimes(picked.id)}
              />
            </View>
          </View>
        ) : undefined
      }
    >
      <NavBar start={<BackButton onPress={() => router.back()} />} />
      <Title subtitle={note ?? t("screens.layout.subtitle")}>{t("screens.layout.title")}</Title>
      {/* Never scrolls: the map takes what's left once the cards are under it, shrinking (and
          centring) to fit when the venue is tall. It sits right on top of the cards, any spare room
          under them. */}
      <View className="flex-1" onLayout={(event) => setRoom(event.nativeEvent.layout.height)}>
        {venue.layout && room > 0 && cardsHeight > 0 ? (
          // 20 to the cards, the entrance tags on its bottom edge hanging into it.
          <View className="mb-5">
            <VenueLayout
              layout={venue.layout}
              grounds={venue.grounds}
              amenities={venue.amenities}
              unavailableIds={unavailableIds}
              pickedId={pickedId}
              onPick={setPickedId}
              maxHeight={room - cardsHeight - MAP_GAP - BELOW}
            />
          </View>
        ) : null}
        <View
          className="gap-3"
          // Hidden for the frame it takes to measure, so the cards don't jump down under the map.
          style={{ opacity: room > 0 && cardsHeight > 0 ? 1 : 0 }}
          onLayout={(event) => setCardsHeight(event.nativeEvent.layout.height)}
        >
          <GroundCards
            grounds={venue.grounds}
            currency={currency}
            pickedId={pickedId}
            onPick={setPickedId}
            matches={matches}
            strongPick
            gutter={GUTTER}
          />
        </View>
      </View>
    </Screen>
  );
}
