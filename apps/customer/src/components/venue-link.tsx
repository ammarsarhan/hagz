import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { push } from "@/lib/navigation";
import { IconChevronRight } from "./icons";
import { Text } from "./text";

// The venue's name (a chevron after it) and its area, opening the venue's page (user,
// 2026-11-23): from a booking's Getting there and a game's Where.
export function VenueLink({
  slug,
  name,
  place,
}: {
  slug: string;
  name: string;
  place?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t("components.venueLink", { venue: name })}
      hitSlop={6}
      onPress={() => push({ pathname: "/venue/[slug]", params: { slug } })}
      className="shrink gap-0.5 active:opacity-60"
    >
      <View className="flex-row items-center gap-1">
        <Text className="shrink text-subtitle leading-[22px] font-medium" numberOfLines={1}>
          {name}
        </Text>
        <View style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}>
          <IconChevronRight size={16} color={colors.ink} strokeWidth={2} />
        </View>
      </View>
      {place ? <Text className="text-label leading-5 text-ink-2">{place}</Text> : null}
    </Pressable>
  );
}
