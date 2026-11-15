import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { dayName, hourLabel, shortDayName, tierAt, type Week } from "@/lib/hours";
import { Text } from "./text";

// The whole week at a glance (Figma "Hours · Week C Week at a glance", 372:2): a column per day and
// a cell per hour, from the morning down past midnight, so each day's late night sits under it.
// Tapping a day opens it.
//
// It shows 8 am to 4 am the next morning, stretched to take in any day that opens earlier or
// closes later.
const CELL = 13;
const GAP = 2;
const FIRST = 8;
const LAST = 28;

export function WeekChart({ week, onDay }: { week: Week; onDay: (day: number) => void }) {
  const { t } = useTranslation();
  const opens = week.flatMap((day) => (day.open ? [day.open] : []));
  const first = Math.min(FIRST, ...opens.map((open) => open.start));
  const last = Math.max(LAST, ...opens.map((open) => open.end));
  const rows = Array.from({ length: last - first }, (_, i) => first + i);

  return (
    <View>
      <View className="flex-row">
        {/* Every fourth hour down the side, level with its row. */}
        <View className="w-9 pe-2" style={{ paddingTop: 24 }}>
          {rows.map((hour) => (
            <View key={hour} style={{ height: CELL + GAP }}>
              {hour % 4 === 0 ? (
                <Text className="text-end text-[11px] leading-[13px] text-ink-3" numberOfLines={1}>
                  {hourLabel(t, hour)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
        <View className="flex-1 flex-row gap-[3px]">
          {week.map((day, dayOfWeek) => (
            <Pressable
              key={dayOfWeek}
              accessibilityRole="button"
              accessibilityLabel={dayName(t, dayOfWeek)}
              onPress={() => onDay(dayOfWeek)}
              className="flex-1 active:opacity-60"
            >
              <Text className="h-6 text-center text-label font-medium">
                {shortDayName(t, dayOfWeek)}
              </Text>
              {rows.map((hour) => {
                const open = day.open && hour >= day.open.start && hour < day.open.end;
                const tier = open ? tierAt(day, hour) : null;
                const look =
                  tier === "PEAK"
                    ? "bg-primary"
                    : tier === "DISCOUNT"
                      ? "border border-dashed border-primary bg-white"
                      : tier === "BASE"
                        ? "bg-[#dce5ff]"
                        : "bg-field";
                return (
                  <View
                    key={hour}
                    className={`rounded-[3px] ${look}`}
                    style={{ height: CELL, marginBottom: GAP }}
                  />
                );
              })}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

// The key under a dial or the chart: what each fill means.
export function TierSwatch({ tier }: { tier: "BASE" | "PEAK" | "DISCOUNT" }) {
  const look =
    tier === "PEAK"
      ? "bg-primary"
      : tier === "DISCOUNT"
        ? "border border-dashed border-primary bg-white"
        : "bg-[#dce5ff]";
  return <View className={`h-3 w-[18px] rounded-[3px] ${look}`} />;
}

export function ChartKey() {
  const { t } = useTranslation();
  return (
    <View className="mt-[22px] flex-row gap-[18px]">
      {(["BASE", "PEAK", "DISCOUNT"] as const).map((tier) => (
        <View key={tier} className="flex-row items-center gap-2">
          <TierSwatch tier={tier} />
          <Text className="text-caption text-ink-2">
            {t(
              tier === "BASE"
                ? "screens.setup.hours.normal"
                : tier === "PEAK"
                  ? "screens.setup.hours.peak"
                  : "screens.setup.hours.discount",
            )}
          </Text>
        </View>
      ))}
    </View>
  );
}
