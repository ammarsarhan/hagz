import { Image } from "expo-image";

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View, type ViewStyle } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import i18n from "@/i18next/i18next";
import { reachable } from "@/lib/api";
import { localDateOf, localTimeOf } from "@/lib/ground-filter";
import { colors } from "@/lib/colors";
import { formatDistance } from "@/lib/distance";
import { fromPerHour } from "@/lib/money";
import { groundsText, sportsText, type VenueCard } from "@/lib/search";
import { timeOfDay } from "@/lib/venue";
import { IconStarFilled } from "./icons";
import { Text } from "./text";
import { push } from "@/lib/navigation";

// A venue in Search's results (Figma "C3 · Tabs & Search"): the list's card (option 1, 96:2) and
// the map's card (option 3, 98:2), both with the venue's next free start times as chips (Fresha's
// results pattern). Tapping any of it opens the venue page.

// The venue page, with what the search asked of its grounds (lib/ground-filter.ts), so the ones that
// don't match are greyed out there.
type Params = Record<string, string>;
const openVenue = (card: VenueCard, params: Params) =>
  push({ pathname: "/venue/[slug]", params: { ...params, slug: card.slug } });

function Rating({ card }: { card: VenueCard }) {
  if (card.rating.average === null) return null;
  return (
    <View className="flex-row items-center gap-1">
      <IconStarFilled size={14} color={colors.ink} />
      <Text className="text-body font-medium">{card.rating.average.toFixed(2)}</Text>
      <Text className="text-body text-ink-2">({card.rating.count})</Text>
    </View>
  );
}

// "Degla, Maadi · 2.4 km".
const placeText = (card: VenueCard) =>
  [card.area, card.distance === null ? null : formatDistance(card.distance)]
    .filter(Boolean)
    .join(" · ");

function Price({ card, currency }: { card: VenueCard; currency: string }) {
  return <Text className="text-body font-medium">{fromPerHour(card.priceFrom, currency)}</Text>;
}

// The next free start times, each with how many grounds are free then.
export function TimeChips({
  card,
  timezone,
  params,
  inset = 0,
}: {
  card: VenueCard;
  timezone: string;
  params: Params;
  // Gutter the row scrolls from and to, when it runs edge to edge.
  inset?: number;
}) {
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={inset ? { marginHorizontal: -inset } : undefined}
      contentContainerStyle={{ gap: 8, paddingHorizontal: inset }}
    >
      {card.nextTimes.map((time) => (
        <Pressable
          key={time.startsAt}
          accessibilityRole="button"
          accessibilityLabel={t("screens.search.card.atTime", {
            venue: card.name ?? t("screens.venue.fallbackName"),
            time: timeOfDay(time.startsAt, timezone),
          })}
          // A time asks for the grounds free from exactly then.
          onPress={() =>
            openVenue(card, {
              ...params,
              date: localDateOf(time.startsAt, timezone),
              start: localTimeOf(time.startsAt, timezone),
            })
          }
          className="min-w-[72px] items-center justify-center rounded-xl border border-border px-3 py-1.5"
        >
          <Text className="text-subtitle font-medium">{timeOfDay(time.startsAt, timezone)}</Text>
          <Text className="text-[12px] leading-4 text-unit">
            {groundsText(time.grounds, card.sports)}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// Sized with a style: expo-image's Image isn't styled by class names.
function Cover({ card, style }: { card: VenueCard; style: ViewStyle }) {
  const { t } = useTranslation();
  const look = { ...style, backgroundColor: "#c4c8cf", overflow: "hidden" as const };
  return card.cover ? (
    <Image
      source={{ uri: reachable(card.cover.url) }}
      style={look}
      contentFit="cover"
      transition={150}
      accessibilityLabel={
        card.name
          ? t("screens.search.card.photoOf", { name: card.name })
          : t("screens.search.card.photoOfVenue")
      }
    />
  ) : (
    <View style={look} />
  );
}

// The list's gutter, which the free times scroll edge to edge from.
const GUTTER = 24;

// The card's badge (docs/architecture.md, "Search ranking"): the player's own standing there first,
// then a free time that came free again, then the venue's loyalty. Null for nothing to say.
export const badgeOf = (card: VenueCard): { label: string; moment: boolean } | null => {
  const you = card.you;
  if (you?.card?.status === "EARNED") {
    return { label: i18n.t("screens.search.card.badges.freeReady"), moment: true };
  }
  if (you?.card?.status === "OPEN") {
    return {
      label: i18n.t("screens.search.card.badges.stamps", {
        stamps: you.card.stamps,
        required: you.card.required,
      }),
      moment: false,
    };
  }
  if (you && you.played > 0) {
    return {
      label: i18n.t("screens.search.card.badges.played", { count: you.played }),
      moment: false,
    };
  }
  if (card.justFreed)
    return { label: i18n.t("screens.search.card.badges.justFreed"), moment: false };
  if (card.loyalty) return { label: i18n.t("screens.search.card.badges.loyalty"), moment: false };
  return null;
};

// On the cover's top right: white, or lime for the one big moment (a free booking ready).
function CoverBadge({ badge }: { badge: { label: string; moment: boolean } }) {
  return (
    <View
      className={`h-7 justify-center rounded-full px-3 ${badge.moment ? "bg-primary" : "bg-white"}`}
      style={{
        shadowColor: "#0b0b0c",
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <Text className="text-[13px] leading-4 font-semibold text-ink">{badge.label}</Text>
    </View>
  );
}

// The list's card (option 1): the cover across the top with its badge, the venue under it, then
// its free times. The compact row (option 2) was dropped once the cards had proved themselves on
// the phone (user, 2026-11-20). Memoised: a card re-renders only when its own venue, the currency
// or the timezone change, not every time Search does (a sport tap was redrawing every card).
export const VenueListCard = memo(function VenueListCard({
  card,
  currency,
  timezone,
  params,
}: {
  card: VenueCard;
  currency: string;
  timezone: string;
  // What the search asked of the grounds, for the venue page's link.
  params: Params;
}) {
  const { t } = useTranslation();
  const badge = badgeOf(card);
  return (
    <View>
      {/* The whole card is one button; the free times under it are their own. No press tint
          (user, 2026-11-20). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          card.name
            ? t("screens.search.card.open", { name: card.name })
            : t("screens.search.card.openVenue")
        }
        onPress={() => openVenue(card, params)}
      >
        <View className="overflow-hidden rounded-2xl bg-[#c4c8cf]" style={{ aspectRatio: 16 / 9 }}>
          {card.cover ? (
            <Image
              source={{ uri: reachable(card.cover.url) }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={150}
            />
          ) : null}
          {badge ? (
            <View pointerEvents="none" className="absolute top-3 right-3">
              <CoverBadge badge={badge} />
            </View>
          ) : null}
        </View>
        <View className="mt-4">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="shrink text-[18px] leading-6 font-medium" numberOfLines={1}>
              {card.name ?? t("screens.venue.fallbackName")}
            </Text>
            <Rating card={card} />
          </View>
          <View className="mt-1 gap-0.5">
            <Text className="text-body text-ink-2" numberOfLines={1}>
              {placeText(card)}
            </Text>
            <Text className="text-body text-ink-2" numberOfLines={1}>
              {sportsText(card.sports)}
            </Text>
            {/* A little more room above the price, setting it apart from the grey lines. */}
            <View className="mt-1">
              <Price card={card} currency={currency} />
            </View>
          </View>
        </View>
      </Pressable>
      <View className="mt-3">
        <TimeChips card={card} timezone={timezone} params={params} inset={GUTTER} />
      </View>
    </View>
  );
});

// Option 3: the picked venue on the map, as a floating card.
export function VenueMapCard({
  card,
  currency,
  timezone,
  params,
}: {
  card: VenueCard;
  currency: string;
  timezone: string;
  // What the search asked of the grounds, for the venue page's link.
  params: Params;
}) {
  const { t } = useTranslation();
  return (
    <View
      className="rounded-[20px] bg-white"
      style={{
        shadowColor: "#0b0b0c",
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
      }}
    >
      {/* A newly picked venue's details fade in over the last one's as they fade out. Every line
          is one line, so the card keeps its height between venues. */}
      <Animated.View
        key={card.id}
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(160)}
        className="gap-4 p-4"
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => openVenue(card, params)}
          className="flex-row gap-3.5"
        >
          <Cover card={card} style={{ width: 64, height: 64, borderRadius: 12 }} />
          <View className="flex-1">
            <View className="flex-row items-center justify-between gap-3">
              <Text className="shrink text-[18px] leading-6 font-medium" numberOfLines={1}>
                {card.name ?? t("screens.venue.fallbackName")}
              </Text>
              <Rating card={card} />
            </View>
            <View className="mt-0.5 gap-0.5">
              <Text className="text-body text-ink-2" numberOfLines={1}>
                {placeText(card)}
              </Text>
              <Price card={card} currency={currency} />
            </View>
          </View>
        </Pressable>
        {/* Under the card's padding to its edges, starting at the padding. */}
        <TimeChips card={card} timezone={timezone} params={params} inset={16} />
      </Animated.View>
    </View>
  );
}
