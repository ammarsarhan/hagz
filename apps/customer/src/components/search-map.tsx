import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { colors } from "@/lib/colors";
import { formatPrice } from "@/lib/money";
import type { VenueCard } from "@/lib/search";
import { IconList } from "./icons";
import { VenueMapCard } from "./search-cards";
import { Text } from "./text";

// Search on a map (Figma "C3 · Tabs & Search", option 3, 98:2): Google Maps under the search bar,
// each venue's hourly price as a pin, and the picked venue's card floating at the bottom. The
// picked pin is black with a lime price; the map first fits every venue found (and the player).

const CAIRO = { latitude: 30.0444, longitude: 31.2357 };

// A price pin: white, or black with a lime price when picked. It switches at once rather than
// fading: a Google Maps marker is a picture of its view, so fading it means redrawing that picture
// every frame on the main thread, which stutters and takes frames from the card's cross-fade too
// (user, 2026-11-20).
function PricePin({ price, picked }: { price: string; picked: boolean }) {
  return (
    <View
      className={`h-7 justify-center rounded-full px-2.5 ${picked ? "bg-ink" : "border border-ink bg-white"}`}
    >
      <Text className={`text-caption font-semibold ${picked ? "text-primary" : "text-ink"}`}>
        {price}
      </Text>
    </View>
  );
}

export function SearchMap({
  cards,
  currency,
  timezone,
  here,
  top,
  bottom,
  onList,
}: {
  cards: VenueCard[];
  currency: string;
  timezone: string;
  here: { latitude: number; longitude: number } | null;
  // How much the search bar covers at the top, and the tab bar at the bottom.
  top: number;
  bottom: number;
  onList: () => void;
}) {
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
            // Remounted when picked or let go, so its picture is drawn once in its new look and
            // otherwise left alone.
            <Marker
              key={`${card.id}-${isPicked ? "on" : "off"}`}
              coordinate={card.coordinates}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              zIndex={isPicked ? 2 : 1}
              onPress={() => pick(card.id)}
            >
              <PricePin price={formatPrice(card.priceFrom, currency)} picked={isPicked} />
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
            label="List"
            icon={<IconList size={18} color={colors.white} strokeWidth={2} />}
            onPress={onList}
          />
        </View>
        {picked ? <VenueMapCard card={picked} currency={currency} timezone={timezone} /> : null}
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
