import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { MAP_PIN, MAP_PIN_SIZE } from "@/assets/map-art";
import { colors } from "@/lib/colors";
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

// The pin doesn't move; the map does. It's drawn over the middle of the map's visible part (what
// the card doesn't cover), with its point on the spot and a shadow under it, so what's being
// placed is obvious even as the map slides about underneath.
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
      className="absolute inset-x-0 items-center"
      style={{ top, bottom, justifyContent: "center" }}
    >
      <View className="items-center">
        <SvgXml xml={MAP_PIN} width={MAP_PIN_SIZE.width} height={MAP_PIN_SIZE.height} />
        {/* The ground under the point. */}
        <View className="-mt-0.5 h-1 w-2.5 rounded-full bg-ink/30" />
        {hint ? (
          <View className="mt-2.5 rounded-hud bg-ink px-3.5 py-2">
            <Text className="text-caption font-medium text-white">{hint}</Text>
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

      <Pressable
        accessibilityRole="button"
        onPress={onChange}
        hitSlop={8}
        className="items-center pb-[18px] pt-4 active:opacity-60"
      >
        <Text className="text-body font-medium text-primary">{change}</Text>
      </Pressable>
    </>
  );
}
