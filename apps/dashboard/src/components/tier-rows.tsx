import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { normalRanges, rangeLabel, type DayHours, type Range } from "@/lib/hours";
import { Text } from "./text";
import { TierSwatch } from "./week-chart";

// Under a dial (Figma 370:2, 375:2): each kind of hour the day has, with when it is. A kind the day
// doesn't use is left out.
export function TierRows({
  day,
  tiers = ["BASE", "PEAK", "DISCOUNT"],
}: {
  day: DayHours;
  tiers?: ("BASE" | "PEAK" | "DISCOUNT")[];
}) {
  const { t } = useTranslation();
  const ranges: Record<"BASE" | "PEAK" | "DISCOUNT", Range[]> = {
    BASE: normalRanges(day),
    PEAK: day.peak ? [day.peak] : [],
    DISCOUNT: day.discount ? [day.discount] : [],
  };
  const shown = tiers.filter((tier) => ranges[tier].length > 0);
  if (shown.length === 0) return null;
  return (
    <View className="mt-4 border-t border-border">
      {shown.map((tier) => (
        <View key={tier} className="flex-row items-center gap-2.5 border-b border-border py-3.5">
          <TierSwatch tier={tier} />
          <Text className="flex-1 text-subtitle font-medium leading-[1.31]">
            {t(
              tier === "BASE"
                ? "screens.setup.hours.normal"
                : tier === "PEAK"
                  ? "screens.setup.hours.peak"
                  : "screens.setup.hours.discount",
            )}
          </Text>
          <Text className="text-body text-ink-2">
            {ranges[tier].map((range) => rangeLabel(t, range)).join(", ")}
          </Text>
        </View>
      ))}
    </View>
  );
}
