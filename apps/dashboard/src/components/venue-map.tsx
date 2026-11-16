import { useRef, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View, type LayoutChangeEvent } from "react-native";
import type MapView from "react-native-maps";
import type { Region } from "react-native-maps";
import { SvgXml } from "react-native-svg";
import { MAP_PIN, MAP_PIN_SIZE } from "@/assets/map-art";
import { colors } from "@/lib/colors";
import type { Coordinates } from "@/lib/places";
import { IconCircleCheckFilled } from "./icons";
import { Text } from "./text";

// The pieces of a venue's full-screen map, shared by adding a venue (app/create-venue/place.tsx)
// and moving its pin from setup (app/setup/[venueId]/location.tsx), so both read the same.

// The white float the map's controls sit on.
export const floatShadow = {
  shadowColor: "#0b0b0c",
  shadowOpacity: 0.14,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
} as const;

// The card along the bottom, lifted off the map.
export const cardShadow = {
  shadowColor: "#0b0b0c",
  shadowOpacity: 0.1,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: -6 },
  elevation: 12,
} as const;

export function FloatingButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="size-11 items-center justify-center rounded-full bg-white active:opacity-80"
      style={floatShadow}
    >
      {children}
    </Pressable>
  );
}

// The pin's point in its artwork (MAP_PIN, 28 × 40): the bottom of the drop, a point above the edge.
const PIN_TIP = 39;

// The tallest view a pin is taken from (the map's latitudeDelta, about 3 km): further out, a
// fingertip covers hundreds of metres, so the pin asks to be zoomed in on first.
export const PLACING_DELTA = 0.03;

// The coordinate under the pin's point. The point sits exactly in the middle of what the status bar
// (`top`) and the card (`bottom`) leave of the map, which is also where the map centres moves when
// its padding is the same; reading it there rather than taking the region's centre keeps the pin
// exact at any zoom. Hand `onLayout` to the MapView.
export function usePinReader(map: RefObject<MapView | null>, top: number, bottom: number) {
  const size = useRef({ width: 0, height: 0 });
  const latest = useRef(0);
  const onLayout = (event: LayoutChangeEvent) => {
    size.current = event.nativeEvent.layout;
  };
  // Null when a later read overtook this one, so a slow answer never undoes a newer one.
  const read = async (region: Region): Promise<Coordinates | null> => {
    const id = ++latest.current;
    let at: Coordinates = { latitude: region.latitude, longitude: region.longitude };
    const { width, height } = size.current;
    if (map.current && height > 0) {
      try {
        at = await map.current.coordinateForPoint({
          x: width / 2,
          y: top + (height - top - bottom) / 2,
        });
      } catch (error) {
        // The region's centre is the next best thing.
        console.warn(error);
      }
    }
    return id === latest.current ? at : null;
  };
  return { onLayout, read };
}

// The pin doesn't move; the map does. Its point sits exactly in the middle of the map's visible part
// (what the status bar and the card leave), where usePinReader reads it, with a shadow under it, so
// what's being placed is obvious even as the map slides about underneath. A hint shows below it
// without moving it.
export function PinOverlay({
  bottom,
  top,
  visible,
  hint,
}: {
  bottom: number;
  top: number;
  visible: boolean;
  hint: string | null;
}) {
  if (!visible) return null;
  return (
    <View
      pointerEvents="none"
      className="absolute inset-x-0 items-center justify-center"
      style={{ top, bottom }}
    >
      {/* A point with no size at the exact middle; everything hangs off it. */}
      <View style={{ width: 0, height: 0, overflow: "visible" }}>
        <View style={{ position: "absolute", top: -PIN_TIP, left: -MAP_PIN_SIZE.width / 2 }}>
          <SvgXml xml={MAP_PIN} width={MAP_PIN_SIZE.width} height={MAP_PIN_SIZE.height} />
        </View>
        {/* The ground under the point. */}
        <View
          className="h-1 w-2.5 rounded-full bg-ink/30"
          style={{ position: "absolute", top: -1, left: -5 }}
        />
        {hint ? (
          <View
            className="items-center"
            style={{ position: "absolute", top: 13, left: -160, width: 320 }}
          >
            <View className="rounded-hud bg-ink px-3.5 py-2">
              <Text className="text-center text-caption font-medium text-white">{hint}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// The area the venue is listed under, ticked, and the link to change it. Both open the area picker.
// With no area yet it asks for one instead.
export function AreaCard({
  label,
  loading,
  change,
  onChange,
}: {
  label: { name: string; within: string } | null;
  loading: boolean;
  change: string;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={onChange}
        disabled={loading}
        className="flex-row items-center justify-between rounded-[16px] border border-primary bg-blue-tint p-4 active:opacity-80"
      >
        {loading ? (
          <ActivityIndicator color={colors.ink3} />
        ) : (
          <>
            <View className="flex-1">
              {/* A row in the card, not a second title: the step's heading already names it. */}
              <Text className="text-subtitle font-semibold">
                {label?.name ?? t("screens.createVenue.place.chooseArea")}
              </Text>
              {label?.within ? (
                <Text className="mt-0.5 text-label text-ink-2">{label.within}</Text>
              ) : null}
            </View>
            {label ? <IconCircleCheckFilled size={20} color={colors.primary} /> : null}
          </>
        )}
      </Pressable>

      <CardLink label={change} onPress={onChange} />
    </>
  );
}

// The quiet blue action under what a map's card shows ("Choose a different area").
// `paired`: a second link straight under another, sharing its spacing rather than doubling it.
export function CardLink({
  label,
  onPress,
  paired = false,
}: {
  label: string;
  onPress: () => void;
  paired?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      className={`items-center pb-[18px] active:opacity-60 ${paired ? "" : "pt-4"}`}
    >
      <Text className="text-body font-medium text-primary">{label}</Text>
    </Pressable>
  );
}
