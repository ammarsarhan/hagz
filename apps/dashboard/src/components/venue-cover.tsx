import { Image } from "expo-image";
import { View } from "react-native";
import type { components } from "@hagz/api";
import { colors } from "@/lib/colors";
import { IconBuildingStadium } from "./icons";

type StaffVenue = components["schemas"]["StaffVenue"];

// A venue's cover, small: the switcher's rows and its "Now on …" HUD. Drawn from the
// preview the venues list carries inline (about 64 px), never the photo itself, so it's there the
// moment the list is, with no request of its own. A venue without one (no photos yet, or photos
// added before previews existed) shows the stadium on grey instead.
export function VenueCover({
  venue,
  size,
  radius,
}: {
  venue: StaffVenue;
  size: number;
  radius: number;
}) {
  if (venue.coverPreview) {
    return (
      <Image
        source={{ uri: venue.coverPreview }}
        contentFit="cover"
        accessibilityIgnoresInvertColors
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }
  return (
    <View
      className="items-center justify-center bg-chip"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <IconBuildingStadium size={Math.round(size * 0.5)} color={colors.ink3} strokeWidth={1.6} />
    </View>
  );
}
