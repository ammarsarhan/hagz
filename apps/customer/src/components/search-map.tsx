import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import i18n from "@/i18next/i18next";
import { colors } from "@/lib/colors";
import { formatDistance } from "@/lib/distance";
import { formatPrice } from "@/lib/money";
import type { SearchSort, VenueCard } from "@/lib/search";
import { timeOfDay } from "@/lib/venue";
import { IconList, IconStarFilled } from "./icons";
import { VenueMapCard } from "./search-cards";
import { Text } from "./text";

// Search on a map (Figma "C3 · Tabs & Search", option 3, 98:2): Google Maps under the search bar,
// each venue as a pin labelled by what the list is sorted by, and the picked venue's card floating
// at the bottom. The picked pin is black with a lime label; the map first fits every venue found
// (and the player).

const CAIRO = { latitude: 30.0444, longitude: 31.2357 };

// What a pin says (user, 2026-11-22): nearest shows the distance, price the price per hour, rating
// the rating beside a star ("New" without one yet), soonest the first free time on any of its
// grounds that fits the search (a search is one day, named in the bar, so the time alone, as on the
// cards); best match shows the price.
const pinLabel = (card: VenueCard, sort: SearchSort, currency: string, timezone: string) => {
  if (sort === "DISTANCE" && card.distance !== null) {
    return { text: formatDistance(card.distance), star: false };
  }
  const soonest = card.nextTimes[0];
  if (sort === "SOONEST" && soonest) {
    return { text: timeOfDay(soonest.startsAt, timezone), star: false };
  }
  if (sort === "RATING") {
    const { average } = card.rating;
    return {
      text: average === null ? i18n.t("screens.search.pinNew") : average.toFixed(2),
      star: true,
    };
  }
  const price = formatPrice(card.priceFrom, currency);
  return { text: sort === "PRICE" ? price + i18n.t("formats.perHour") : price, star: false };
};

// A pin: white, or black with a lime label when picked. It switches at once rather than fading: a
// Google Maps marker is a picture of its view, so fading it means redrawing that picture every frame
// on the main thread, which stutters and takes frames from the card's cross-fade too (user,
// 2026-11-20).
function Pin({ text, star, picked }: { text: string; star: boolean; picked: boolean }) {
  return (
    <View
      className={`h-7 flex-row items-center gap-1 rounded-full px-2.5 ${picked ? "bg-ink" : "border border-ink bg-white"}`}
    >
      {star ? <IconStarFilled size={12} color={picked ? colors.lime : colors.ink} /> : null}
      <Text className={`text-caption font-semibold ${picked ? "text-primary" : "text-ink"}`}>
        {text}
      </Text>
    </View>
  );
}

export function SearchMap({
  cards,
  sort,
  currency,
  timezone,
  params,
  here,
  top,
  bottom,
  onList,
}: {
  cards: VenueCard[];
  sort: SearchSort;
  currency: string;
  timezone: string;
  // What the search asked of the grounds, for the venue page's link.
  params: Record<string, string>;
  here: { latitude: number; longitude: number } | null;
  // How much the search bar covers at the top, and the tab bar at the bottom.
  top: number;
  bottom: number;
  onList: () => void;
}) {
  const { t } = useTranslation();
  const map = useRef<MapView>(null);
  const placed = cards.filter((card) => card.coordinates !== null);
  const [pickedId, setPickedId] = useState<string | null>(placed[0]?.id ?? null);
  const picked = placed.find((card) => card.id === pickedId) ?? placed[0];
  const pick = (id: string) => {
    if (id !== picked?.id) setPickedId(id);
  };

  // Fit everything found once there's something to fit.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || placed.length === 0) return;
    fitted.current = true;
    const points = placed.flatMap((card) => (card.coordinates ? [card.coordinates] : []));
    map.current?.fitToCoordinates(here ? [...points, here] : points, {
      edgePadding: { top: top + 40, right: 48, bottom: bottom + 220, left: 48 },
      animated: false,
    });
  }, [placed, here, top, bottom]);

  return (
    <View className="flex-1">
      <MapView
        ref={map}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={{ ...(here ?? CAIRO), latitudeDelta: 0.12, longitudeDelta: 0.12 }}
        showsUserLocation={here !== null}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {placed.map((card) => {
          const isPicked = card.id === picked?.id;
          return card.coordinates ? (
            // Remounted when picked or let go, or the sort changes its label, so its picture is
            // drawn once in its new look and otherwise left alone.
            <Marker
              key={`${card.id}-${sort}-${isPicked ? "on" : "off"}`}
              coordinate={card.coordinates}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              zIndex={isPicked ? 2 : 1}
              onPress={() => pick(card.id)}
            >
              <Pin {...pinLabel(card, sort, currency, timezone)} picked={isPicked} />
            </Marker>
          ) : null;
        })}
      </MapView>
      {/* The way back to the list (the list's Map pill, mirrored), over the picked venue's card. */}
      <View
        className="absolute right-4 left-4 gap-3"
        style={{ bottom: bottom + 12 }}
        pointerEvents="box-none"
      >
        <View className="items-center" pointerEvents="box-none">
          <MapToggle
            label={t("screens.search.list")}
            icon={<IconList size={18} color={colors.white} strokeWidth={2} />}
            onPress={onList}
          />
        </View>
        {picked ? (
          <VenueMapCard card={picked} currency={currency} timezone={timezone} params={params} />
        ) : null}
      </View>
    </View>
  );
}

// The round button that goes back to the list.
export function MapToggle({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-11 flex-row items-center gap-2 rounded-full bg-ink px-5 active:opacity-80"
    >
      {icon}
      <Text className="text-body font-semibold text-white">{label}</Text>
    </Pressable>
  );
}
