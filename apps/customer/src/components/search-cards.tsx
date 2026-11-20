import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, View, type ViewStyle } from "react-native";
import { reachable } from "@/lib/api";
import { colors } from "@/lib/colors";
import { formatDistance } from "@/lib/distance";
import { formatPrice } from "@/lib/money";
import { groundsText, sportsText, type VenueCard } from "@/lib/search";
import { timeOfDay } from "@/lib/venue";
import { IconStarFilled } from "./icons";
import { Text } from "./text";

// A venue in Search's results (Figma "C3 · Tabs & Search"): the big card (option 1, 96:2), the
// compact row (option 2, 97:2) and the map's card (option 3, 98:2), all with the venue's next free
// start times as chips (Fresha's results pattern). Tapping any of it opens the venue page.

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
          className="min-w-[72px] items-center justify-center rounded-xl border border-border px-3 py-1.5 active:bg-chip"
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

// Option 1: the photo across the card, then the venue, then its free times.
export function VenueCardLarge({
  card,
  currency,
  timezone,
}: {
  card: VenueCard;
  currency: string;
  timezone: string;
}) {
  return (
    <View className="gap-3">
      <Pressable accessibilityRole="button" onPress={() => openVenue(card)} className="gap-4">
        <Cover card={card} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 16 }} />
        <View className="gap-0.5">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="shrink text-[17px] leading-[22px] font-medium" numberOfLines={1}>
              {card.name ?? "Venue"}
            </Text>
            <Rating card={card} />
          </View>
          <Text className="text-body text-ink-2">{placeText(card)}</Text>
          <Text className="text-body text-ink-2">{sportsText(card.sports)}</Text>
          <Price card={card} currency={currency} />
        </View>
      </Pressable>
      <TimeChips card={card} timezone={timezone} inset={24} />
    </View>
  );
}

// Option 2: a square photo beside the venue, its free times under both.
export function VenueRow({
  card,
  currency,
  timezone,
}: {
  card: VenueCard;
  currency: string;
  timezone: string;
}) {
  return (
    <View className="gap-3">
      <Pressable
        accessibilityRole="button"
        onPress={() => openVenue(card)}
        className="flex-row gap-3.5"
      >
        <Cover card={card} style={{ width: 84, height: 84, borderRadius: 14 }} />
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="shrink text-[17px] leading-[22px] font-medium" numberOfLines={1}>
              {card.name ?? "Venue"}
            </Text>
            <Rating card={card} />
          </View>
          <Text className="text-body text-ink-2">{placeText(card)}</Text>
          <Text className="text-body text-ink-2">{sportsText(card.sports)}</Text>
          <Price card={card} currency={currency} />
        </View>
      </Pressable>
      <TimeChips card={card} timezone={timezone} inset={24} />
    </View>
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
      className="gap-3 rounded-[20px] bg-white p-4"
      style={{
        shadowColor: "#0b0b0c",
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => openVenue(card)}
        className="flex-row gap-3.5"
      >
        <Cover card={card} style={{ width: 64, height: 64, borderRadius: 12 }} />
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="shrink text-[17px] leading-[22px] font-medium" numberOfLines={1}>
              {card.name ?? "Venue"}
            </Text>
            <Rating card={card} />
          </View>
          <Text className="text-body text-ink-2">{placeText(card)}</Text>
          <Price card={card} currency={currency} />
        </View>
      </Pressable>
      <TimeChips card={card} timezone={timezone} />
    </View>
  );
}
