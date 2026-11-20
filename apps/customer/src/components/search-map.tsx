import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
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

// Picked, its black (with the lime price) fades in over the white one, like Search's sport chips.
const PIN_FADE = 200;

function PricePin({ price, picked }: { price: string; picked: boolean }) {
  const shown = useSharedValue(picked ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(picked ? 1 : 0, { duration: PIN_FADE });
  }, [picked, shown]);
  const fill = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <View className="h-7 justify-center rounded-full border border-ink bg-white px-2.5">
      <Text className="text-caption font-semibold text-ink">{price}</Text>
      <Animated.View
        className="absolute -inset-px items-center justify-center rounded-full bg-ink"
        style={fill}
      >
        <Text className="text-caption font-semibold text-primary">{price}</Text>
      </Animated.View>
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
  // A marker is drawn once into an image and left alone (tracksViewChanges off), so the two pins
  // changing (the one picked and the one let go) are redrawn every frame only while they fade.
  const [fading, setFading] = useState<string[]>([]);
  useEffect(() => {
    if (fading.length === 0) return;
    const done = setTimeout(() => setFading([]), PIN_FADE + 80);
    return () => clearTimeout(done);
  }, [fading]);
  const pick = (id: string) => {
    if (id === picked?.id) return;
    setFading(picked ? [picked.id, id] : [id]);
    setPickedId(id);
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
            <Marker
              key={card.id}
              coordinate={card.coordinates}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={fading.includes(card.id)}
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
