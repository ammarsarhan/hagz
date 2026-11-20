import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { reachable } from "@/lib/api";
import { colors } from "@/lib/colors";
import { formatDistance } from "@/lib/distance";
import { formatPrice } from "@/lib/money";
import { groundsText, sportsText, type VenueCard } from "@/lib/search";
import { timeOfDay } from "@/lib/venue";
import { IconStarFilled } from "./icons";
import { Text } from "./text";

// A venue in Search's results (Figma "C3 · Tabs & Search"): the list's card, morphing between the
// big card (option 1, 96:2) and the compact row (option 2, 97:2), and the map's card (option 3,
// 98:2), all with the venue's next free start times as chips (Fresha's results pattern). Tapping
// any of it opens the venue page.

const openVenue = (card: VenueCard) =>
  router.push({ pathname: "/venue/[slug]", params: { slug: card.slug } });

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
  return (
    <Text className="text-body font-medium">from {formatPrice(card.priceFrom, currency)}/hr</Text>
  );
}

// The next free start times, each with how many grounds are free then.
export function TimeChips({
  card,
  timezone,
  inset = 0,
}: {
  card: VenueCard;
  timezone: string;
  // Gutter the row scrolls from and to, when it runs edge to edge.
  inset?: number;
}) {
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
          accessibilityLabel={`${card.name ?? "Venue"} at ${timeOfDay(time.startsAt, timezone)}`}
          onPress={() => openVenue(card)}
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
  const look = { ...style, backgroundColor: "#c4c8cf", overflow: "hidden" as const };
  return card.cover ? (
    <Image
      source={{ uri: reachable(card.cover.url) }}
      style={look}
      contentFit="cover"
      transition={150}
      accessibilityLabel={`Photo of ${card.name ?? "the venue"}`}
    />
  ) : (
    <View style={look} />
  );
}

// Options 1 and 2 as one card that morphs between them (user, 2026-11-20): `compact` runs 0 → 1
// from the cover layout (photo across the top, the venue under it) to the row (an 84 point photo
// with the venue beside it). The photo's box shrinks and re-crops, the words slide up beside it,
// the free times rise under it, and the card's height follows, all on the UI thread. Each line is
// one line at either width, so the words' height doesn't change as they narrow.
const THUMB = 84;
const BESIDE = 14;
const UNDER = 16;
const CHIPS_GAP = 12;
const GUTTER = 24;

export function VenueListCard({
  card,
  currency,
  timezone,
  compact,
}: {
  card: VenueCard;
  currency: string;
  timezone: string;
  compact: SharedValue<number>;
}) {
  const { width: screen } = useWindowDimensions();
  const inner = screen - 2 * GUTTER;
  const coverHeight = Math.round((inner * 9) / 16);
  // Measured once laid out; a first guess until then.
  const [wordsHeight, setWordsHeight] = useState(88);
  const [chipsHeight, setChipsHeight] = useState(50);

  const box = useAnimatedStyle(() => {
    const open = coverHeight + UNDER + wordsHeight + CHIPS_GAP + chipsHeight;
    const shut = Math.max(THUMB, wordsHeight) + CHIPS_GAP + chipsHeight;
    return { height: interpolate(compact.value, [0, 1], [open, shut]) };
  });
  const photo = useAnimatedStyle(() => ({
    width: interpolate(compact.value, [0, 1], [inner, THUMB]),
    height: interpolate(compact.value, [0, 1], [coverHeight, THUMB]),
    borderRadius: interpolate(compact.value, [0, 1], [16, 14]),
  }));
  const words = useAnimatedStyle(() => ({
    width: interpolate(compact.value, [0, 1], [inner, inner - THUMB - BESIDE]),
    transform: [
      { translateX: interpolate(compact.value, [0, 1], [0, THUMB + BESIDE]) },
      { translateY: interpolate(compact.value, [0, 1], [coverHeight + UNDER, 0]) },
    ],
  }));
  const chips = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          compact.value,
          [0, 1],
          [coverHeight + UNDER + wordsHeight + CHIPS_GAP, Math.max(THUMB, wordsHeight) + CHIPS_GAP],
        ),
      },
    ],
  }));

  return (
    <Animated.View style={box}>
      {/* The whole card is one button; the free times inside it are their own. No press tint
          (user, 2026-11-20). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${card.name ?? "the venue"}`}
        onPress={() => openVenue(card)}
        style={StyleSheet.absoluteFill}
      >
        <Animated.View className="absolute top-0 left-0" style={words}>
          <View onLayout={(event) => setWordsHeight(Math.round(event.nativeEvent.layout.height))}>
            <View className="flex-row items-center justify-between gap-3">
              <Text className="shrink text-[18px] leading-6 font-medium" numberOfLines={1}>
                {card.name ?? "Venue"}
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
              <Price card={card} currency={currency} />
            </View>
          </View>
        </Animated.View>
        {/* After the words, so as the photo shrinks the words slide in under it, not over. */}
        <Animated.View className="absolute top-0 left-0 overflow-hidden bg-[#c4c8cf]" style={photo}>
          {card.cover ? (
            <Image
              source={{ uri: reachable(card.cover.url) }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={150}
            />
          ) : null}
        </Animated.View>
      </Pressable>
      <Animated.View
        className="absolute top-0 right-0 left-0"
        style={chips}
        onLayout={(event) => setChipsHeight(Math.round(event.nativeEvent.layout.height))}
      >
        <TimeChips card={card} timezone={timezone} inset={GUTTER} />
      </Animated.View>
    </Animated.View>
  );
}

// Option 3: the picked venue on the map, as a floating card.
export function VenueMapCard({
  card,
  currency,
  timezone,
}: {
  card: VenueCard;
  currency: string;
  timezone: string;
}) {
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
          onPress={() => openVenue(card)}
          className="flex-row gap-3.5"
        >
          <Cover card={card} style={{ width: 64, height: 64, borderRadius: 12 }} />
          <View className="flex-1">
            <View className="flex-row items-center justify-between gap-3">
              <Text className="shrink text-[18px] leading-6 font-medium" numberOfLines={1}>
                {card.name ?? "Venue"}
              </Text>
              <Rating card={card} />
            </View>
            <View className="mt-1.5 gap-0.5">
              <Text className="text-body text-ink-2" numberOfLines={1}>
                {placeText(card)}
              </Text>
              <Price card={card} currency={currency} />
            </View>
          </View>
        </Pressable>
        {/* Under the card's padding to its edges, starting at the padding. */}
        <TimeChips card={card} timezone={timezone} inset={16} />
      </Animated.View>
    </View>
  );
}
