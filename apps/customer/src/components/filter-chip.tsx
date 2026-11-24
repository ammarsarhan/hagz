import type { Icon } from "@tabler/icons-react-native";
import { memo, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors } from "@/lib/colors";
import { IconX } from "./icons";
import { Text } from "./text";

// A chip in the row under the bar (Figma B2, 133:2): picked, its black (with white words) fades in
// over the white one; a sport leads with its ball, and an applied filter carries an × that takes it
// off. Memoised with an id and one
// stable handler, so a tap re-renders only the chips that change.
export const FilterChip = memo(function FilterChip({
  id,
  label,
  on,
  removable = false,
  icon,
  ball: Ball,
  onSelect,
}: {
  id: string;
  label: string;
  on: boolean;
  removable?: boolean;
  icon?: ReactNode;
  // A sport's ball before its name, ink on white and white on black.
  ball?: Icon;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const shown = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(on ? 1 : 0, { duration: 180 });
  }, [on, shown]);
  const fill = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={removable ? t("screens.search.remove", { label }) : label}
      onPress={() => onSelect(id)}
      className={`h-10 flex-row items-center gap-1.5 rounded-full border bg-white px-4 ${icon ? "border-ink" : "border-border"}`}
    >
      {icon}
      {Ball ? <Ball size={16} color={colors.ink} strokeWidth={2} /> : null}
      <Text className="text-body font-medium">{label}</Text>
      {removable ? <IconX size={14} color={colors.ink} strokeWidth={2.25} /> : null}
      <Animated.View
        pointerEvents="none"
        className="absolute -inset-px flex-row items-center justify-center gap-1.5 rounded-full bg-ink"
        style={fill}
      >
        {Ball ? <Ball size={16} color={colors.white} strokeWidth={2} /> : null}
        <Text className="text-body font-medium text-white">{label}</Text>
      </Animated.View>
    </Pressable>
  );
});
