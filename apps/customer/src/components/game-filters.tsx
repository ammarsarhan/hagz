import type { components } from "@hagz/api";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, useWindowDimensions, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import i18n from "@/i18next/i18next";
import { formatPrice } from "@/lib/money";
import { localDate, settingName, sizeName, surfaceName } from "@/lib/search";
import { dayLabel } from "@/lib/venue";
import { Button } from "./button";
import { Group, Label, Pill, Pills, toggled } from "./search-filters";
import { Sheet } from "./sheet";
import { Text } from "./text";

// Community's filters, the Search tab's way (user, 2026-11-23): one sheet from the Filters chip, a
// draft applied with Show games, Clear all to start over. When (a day, a time of day), how far, what
// a player pays, the ground, and how many spots are left (to join with friends). The sport and its
// sizes are chips in the row, as on Search; what's applied follows them, each with an ×.

type Sport = components["schemas"]["GroundSport"];
type Size = components["schemas"]["GroundSize"];
type Surface = components["schemas"]["GroundSurface"];
type Setting = components["schemas"]["GroundEnvironment"];
export type TimeOfDay = "MORNING" | "AFTERNOON" | "EVENING" | "LATE";

export interface GameFilters {
  // Kilometres around the player; null for anywhere.
  radius: number | null;
  date: string | null;
  time?: TimeOfDay;
  sport?: Sport;
  size?: Size;
  surfaces: Surface[];
  settings: Setting[];
  // A player's share and joining fee together, in minor units.
  priceMax?: number;
  spots?: number;
}

export const RADIUS = 25;
export const NO_GAME_FILTERS: GameFilters = {
  radius: RADIUS,
  date: null,
  surfaces: [],
  settings: [],
};

const TIMEZONE = "Africa/Cairo";
const CURRENCY = "EGP";
const TIMES: TimeOfDay[] = ["MORNING", "AFTERNOON", "EVENING", "LATE"];
// Each time of day as start hours at the venue: from (inclusive) to (exclusive).
const HOURS: Record<TimeOfDay, { fromHour?: number; toHour?: number }> = {
  MORNING: { toHour: 12 },
  AFTERNOON: { fromHour: 12, toHour: 17 },
  EVENING: { fromHour: 17, toHour: 21 },
  LATE: { fromHour: 21 },
};
const RADII = [5, 10, 25, 50];
const PRICES = [10_000, 15_000, 20_000, 30_000];
const SPOTS = [2, 3, 4];
const FOOTBALL_SIZES: Size[] = ["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"];
const SURFACES: Surface[] = ["ARTIFICIAL_TURF", "NATURAL_GRASS", "HARD_COURT", "HARD_WOOD", "SAND"];
const SETTINGS: Setting[] = ["INDOOR", "OUTDOOR", "COVERED"];

// "Today", "Tomorrow", or "Sat 28 Nov".
export const dayName = (date: string) =>
  date === localDate(TIMEZONE)
    ? i18n.t("screens.community.today")
    : date === localDate(TIMEZONE, 1)
      ? i18n.t("screens.community.tomorrow")
      : dayLabel(date);

const timeName = (time: TimeOfDay) => i18n.t(`screens.community.times.${time}`);
const priceName = (price: number) =>
  i18n.t("screens.community.upTo", { price: formatPrice(price, CURRENCY) });

// The feed's query for the filters (where the player is, if they can be placed, aside).
export const gameQuery = (filters: GameFilters) => ({
  ...(filters.date ? { date: filters.date } : {}),
  ...(filters.time ? HOURS[filters.time] : {}),
  ...(filters.sport ? { sport: filters.sport } : {}),
  ...(filters.size ? { size: filters.size } : {}),
  ...(filters.surfaces.length > 0 ? { surface: filters.surfaces.join(",") } : {}),
  ...(filters.settings.length > 0 ? { setting: filters.settings.join(",") } : {}),
  ...(filters.priceMax !== undefined ? { priceMax: filters.priceMax } : {}),
  ...(filters.spots !== undefined ? { spots: filters.spots } : {}),
});

// What's applied, as chips after the sports: each with the filters it takes off.
export const appliedGameFilters = (
  filters: GameFilters,
  located: boolean,
): { key: string; label: string; without: (filters: GameFilters) => GameFilters }[] => [
  ...(filters.date
    ? [
        {
          key: "date",
          label: dayName(filters.date),
          without: (f: GameFilters) => ({ ...f, date: null }),
        },
      ]
    : []),
  ...(filters.time
    ? [
        {
          key: "time",
          label: timeName(filters.time),
          without: (f: GameFilters) => ({ ...f, time: undefined }),
        },
      ]
    : []),
  ...(located && filters.radius !== RADIUS
    ? [
        {
          key: "radius",
          label:
            filters.radius === null
              ? i18n.t("screens.community.anywhere")
              : i18n.t("screens.community.within", { km: filters.radius }),
          without: (f: GameFilters) => ({ ...f, radius: RADIUS }),
        },
      ]
    : []),
  ...(filters.priceMax !== undefined
    ? [
        {
          key: "price",
          label: priceName(filters.priceMax),
          without: (f: GameFilters) => ({ ...f, priceMax: undefined }),
        },
      ]
    : []),
  ...filters.surfaces.map((surface) => ({
    key: `surface:${surface}`,
    label: surfaceName(surface),
    without: (f: GameFilters) => ({
      ...f,
      surfaces: f.surfaces.filter((each) => each !== surface),
    }),
  })),
  ...filters.settings.map((setting) => ({
    key: `setting:${setting}`,
    label: settingName(setting),
    without: (f: GameFilters) => ({
      ...f,
      settings: f.settings.filter((each) => each !== setting),
    }),
  })),
  ...(filters.spots !== undefined
    ? [
        {
          key: "spots",
          label: i18n.t("screens.community.spotsAtLeast", { count: filters.spots }),
          without: (f: GameFilters) => ({ ...f, spots: undefined }),
        },
      ]
    : []),
];

export function GameFiltersSheet({
  visible,
  filters,
  located,
  onApply,
  onClose,
}: {
  visible: boolean;
  filters: GameFilters;
  // Whether the player's spot is known, so how far can be asked.
  located: boolean;
  onApply: (filters: GameFilters) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState(filters);
  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);
  const set = (change: Partial<GameFilters>) => setDraft((now) => ({ ...now, ...change }));
  const days = Array.from({ length: 7 }, (_, i) => localDate(TIMEZONE, i));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      header={<Text className="text-subtitle font-semibold">{t("screens.community.filters")}</Text>}
      scrolls
    >
      <ScrollView
        style={{ maxHeight: height * 0.66 }}
        className="-mx-6 mt-4 border-t border-border"
        contentContainerClassName="px-6"
        showsVerticalScrollIndicator={false}
      >
        <Group title={t("screens.community.when")}>
          <Label first>{t("screens.community.day")}</Label>
          <Pills>
            <Pill
              label={t("screens.community.anyDay")}
              on={draft.date === null}
              onPress={() => set({ date: null })}
            />
            {days.map((day) => (
              <Pill
                key={day}
                label={dayName(day)}
                on={draft.date === day}
                onPress={() => set({ date: day })}
              />
            ))}
          </Pills>
          <Label>{t("screens.community.timeOfDay")}</Label>
          <Pills>
            <Pill
              label={t("screens.community.anyTime")}
              on={!draft.time}
              onPress={() => set({ time: undefined })}
            />
            {TIMES.map((time) => (
              <Pill
                key={time}
                label={timeName(time)}
                on={draft.time === time}
                onPress={() => set({ time })}
              />
            ))}
          </Pills>
        </Group>

        {located ? (
          <Group title={t("screens.community.distance")}>
            <Pills>
              {RADII.map((radius) => (
                <Pill
                  key={radius}
                  label={t("screens.community.within", { km: radius })}
                  on={draft.radius === radius}
                  onPress={() => set({ radius })}
                />
              ))}
              <Pill
                label={t("screens.community.anywhere")}
                on={draft.radius === null}
                onPress={() => set({ radius: null })}
              />
            </Pills>
          </Group>
        ) : null}

        <Group title={t("screens.community.price")}>
          <Text className="-mt-1 mb-3 text-label text-ink-2">
            {t("screens.community.priceLine")}
          </Text>
          <Pills>
            <Pill
              label={t("screens.community.anyPrice")}
              on={draft.priceMax === undefined}
              onPress={() => set({ priceMax: undefined })}
            />
            {PRICES.map((price) => (
              <Pill
                key={price}
                label={priceName(price)}
                on={draft.priceMax === price}
                onPress={() => set({ priceMax: price })}
              />
            ))}
          </Pills>
        </Group>

        <Group title={t("screens.community.ground")}>
          {draft.sport === "FOOTBALL" ? (
            <>
              <Label first>{t("screens.community.size")}</Label>
              <Pills>
                <Pill
                  label={t("screens.community.anySize")}
                  on={!draft.size}
                  onPress={() => set({ size: undefined })}
                />
                {FOOTBALL_SIZES.map((size) => (
                  <Pill
                    key={size}
                    label={sizeName(size)}
                    on={draft.size === size}
                    onPress={() => set({ size })}
                  />
                ))}
              </Pills>
            </>
          ) : null}
          <Label first={draft.sport !== "FOOTBALL"}>{t("screens.community.surface")}</Label>
          <Pills>
            {SURFACES.map((surface) => (
              <Pill
                key={surface}
                label={surfaceName(surface)}
                on={draft.surfaces.includes(surface)}
                onPress={() => set({ surfaces: toggled(draft.surfaces, surface) })}
              />
            ))}
          </Pills>
          <Label>{t("screens.community.setting")}</Label>
          <Pills>
            {SETTINGS.map((setting) => (
              <Pill
                key={setting}
                label={settingName(setting)}
                on={draft.settings.includes(setting)}
                onPress={() => set({ settings: toggled(draft.settings, setting) })}
              />
            ))}
          </Pills>
        </Group>

        <Group title={t("screens.community.spots")} last>
          <Text className="-mt-1 mb-3 text-label text-ink-2">
            {t("screens.community.spotsLine")}
          </Text>
          <Pills>
            <Pill
              label={t("screens.community.anySpots")}
              on={draft.spots === undefined}
              onPress={() => set({ spots: undefined })}
            />
            {SPOTS.map((spots) => (
              <Pill
                key={spots}
                label={t("screens.community.spotsAtLeast", { count: spots })}
                on={draft.spots === spots}
                onPress={() => set({ spots })}
              />
            ))}
          </Pills>
        </Group>
      </ScrollView>

      <View className="-mx-6 flex-row items-center justify-between gap-4 border-t border-border px-6 pt-4">
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          // Clears everything, the sport too, and closes on the cleared feed.
          onPress={() => onApply(NO_GAME_FILTERS)}
          className="active:opacity-60"
        >
          <Text className="text-subtitle font-medium underline">
            {t("screens.search.filtersSheet.clearAll")}
          </Text>
        </Pressable>
        <View className="w-[200px]">
          <Button label={t("screens.community.show")} size="small" onPress={() => onApply(draft)} />
        </View>
      </View>
    </Sheet>
  );
}
