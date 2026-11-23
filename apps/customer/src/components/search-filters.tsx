import type { components } from "@hagz/api";
import { memo, useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Switch, useWindowDimensions, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors } from "@/lib/colors";
import {
  type Amenity,
  filterQuery,
  type Filters,
  type GroundSize,
  NO_FILTERS,
  type Payment,
  priceText,
  type SearchParams,
  type SearchSort,
  type Setting,
  settingName,
  sizeName,
  type Sport,
  surfaceName,
  type Surface,
  useAmenities,
  useSpread,
  useVenueCount,
} from "@/lib/search";
import { AmenityIcon } from "./amenity-icon";
import { Button } from "./button";
import { EmptyBars, RangeBars, type Range } from "./range-bars";
import { Sheet } from "./sheet";
import { Text } from "./text";

// Filters (Figma "C3 · Tabs & Search" A1, 127:2 and 128:2; the user's pick on 2026-11-20): one long
// sheet from the search bar's round button. Sort, the price per hour as a range over a chart of how
// many venues charge each (the When sheet's language), the ground, the venue, how booking works,
// perks. A draft, applied with Show N venues, which counts it as it changes; Clear all clears every
// filter and the order and closes.
//
// Each group is its own memoised section given only its part of the draft, so a tap (or a step of
// the price handles) re-renders that group alone, not the whole sheet.

type AmenityIconName = components["schemas"]["AmenityIcon"];
type SetFilters = (change: Partial<Filters>) => void;

// Each sort's pill says screens.search.filtersSheet.sorts.<sort>; Nearest needs the player's spot.
const SORTS: { sort: SearchSort; near?: boolean }[] = [
  { sort: "BEST_MATCH" },
  { sort: "DISTANCE", near: true },
  { sort: "PRICE" },
  { sort: "RATING" },
  { sort: "SOONEST" },
];
const FOOTBALL_SIZES: GroundSize[] = ["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"];
const SURFACES: Surface[] = ["ARTIFICIAL_TURF", "NATURAL_GRASS", "HARD_COURT", "HARD_WOOD", "SAND"];
const SETTINGS: Setting[] = ["INDOOR", "OUTDOOR", "COVERED"];
const GROUNDS = [undefined, 2, 3, 5];
const RATINGS = [undefined, 4, 4.5];
const PAYMENTS: (Payment | undefined)[] = [undefined, "CASH", "ONLINE"];

// A pill: picked, its black (with white words) fades in over the white one, as the sport chips do.
export const Pill = memo(function Pill({
  label,
  on,
  icon,
  onPress,
}: {
  label: string;
  on: boolean;
  icon?: AmenityIconName;
  onPress: () => void;
}) {
  const shown = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(on ? 1 : 0, { duration: 180 });
  }, [on, shown]);
  const fill = useAnimatedStyle(() => ({ opacity: shown.value }));
  const inside = (color: string, words: string) => (
    <>
      {icon ? <AmenityIcon name={icon} size={16} color={color} /> : null}
      <Text className={`text-body font-medium ${words}`}>{label}</Text>
    </>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className="h-10 flex-row items-center gap-1.5 rounded-full border border-border bg-white px-4"
    >
      {inside(colors.ink, "text-ink")}
      <Animated.View
        pointerEvents="none"
        className="absolute -inset-px flex-row items-center justify-center gap-1.5 rounded-full bg-ink"
        style={fill}
      >
        {inside(colors.white, "text-white")}
      </Animated.View>
    </Pressable>
  );
});

export function Group({
  title,
  last = false,
  children,
}: {
  title: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <View className={`py-6 ${last ? "" : "border-b border-border"}`}>
      <Text accessibilityRole="header" className="mb-3 text-[18px] leading-6 font-semibold">
        {title}
      </Text>
      {children}
    </View>
  );
}

export function Label({ children, first = false }: { children: string; first?: boolean }) {
  return <Text className={`${first ? "" : "mt-4"} mb-2 text-label text-ink-2`}>{children}</Text>;
}

export function Pills({ children }: { children: ReactNode }) {
  return <View className="flex-row flex-wrap gap-2">{children}</View>;
}

function Toggle({
  title,
  line,
  on,
  onChange,
}: {
  title: string;
  line: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-4 py-2">
      <View className="shrink gap-0.5">
        <Text className="text-subtitle">{title}</Text>
        <Text className="text-caption text-ink-2">{line}</Text>
      </View>
      <Switch
        value={on}
        onValueChange={onChange}
        trackColor={{ true: colors.ink, false: colors.chip }}
        ios_backgroundColor={colors.chip}
      />
    </View>
  );
}

export const toggled = <T,>(list: T[], item: T) =>
  list.includes(item) ? list.filter((each) => each !== item) : [...list, item];

const SortSection = memo(function SortSection({
  sort,
  near,
  onSort,
}: {
  sort: SearchSort;
  near: boolean;
  onSort: (sort: SearchSort) => void;
}) {
  const { t } = useTranslation();
  return (
    <Group title={t("screens.search.filtersSheet.sortBy")}>
      <Pills>
        {SORTS.filter((each) => !each.near || near).map((each) => (
          <Pill
            key={each.sort}
            label={t(`screens.search.filtersSheet.sorts.${each.sort}`)}
            on={sort === each.sort}
            onPress={() => onSort(each.sort)}
          />
        ))}
      </Pills>
    </Group>
  );
});

// The chart never has fewer than this many bands: a few venues' prices (one, at the least) would
// otherwise fill the width as a block or two of black. Empty bands go either side of the real ones,
// never below zero, so the prices sit in the middle as slim bars.
const MIN_BANDS = 12;

const padBands = (bands: number[], step: number) => {
  const first = bands[0];
  if (first === undefined || bands.length >= MIN_BANDS) return bands;
  const missing = MIN_BANDS - bands.length;
  const before = Math.min(Math.floor(missing / 2), Math.floor(first / step));
  const start = first - before * step;
  return Array.from({ length: MIN_BANDS }, (_, i) => start + i * step);
};

// The price chart: its bands (the axis) come from the search without the filters, so they stay put
// as filters change; the bars count what the other filters leave, flat when that's nothing.
const PriceSection = memo(function PriceSection({
  axis,
  counts,
  priceMin,
  priceMax,
  currency,
  set,
}: {
  axis: number[] | null;
  counts: Map<number, number>;
  priceMin: number | undefined;
  priceMax: number | undefined;
  currency: string;
  set: SetFilters;
}) {
  const { t } = useTranslation();
  const real = axis ?? [];
  const step = real.length > 1 ? (real[1] ?? 0) - (real[0] ?? 0) : 5000;
  const bands = padBands(real, step);
  const bandOf = (price: number) =>
    Math.max(
      0,
      bands.findIndex((from) => from + step > price),
    );
  const range: Range = {
    from: priceMin === undefined ? 0 : bandOf(priceMin),
    to: priceMax === undefined ? bands.length : bandOf(priceMax) + 1,
  };
  const setRange = (next: Range) => {
    set(
      next.from === 0 && next.to === bands.length
        ? { priceMin: undefined, priceMax: undefined }
        : {
            priceMin: next.from === 0 ? undefined : bands[next.from],
            priceMax: next.to === bands.length ? undefined : (bands[next.to] ?? 0) - 1,
          },
    );
  };
  // Untouched, the label says the real prices, not the empty bands either side of them.
  const whole = range.from === 0 && range.to === bands.length;
  const low = whole ? real[0] : bands[range.from];
  const highFrom = whole ? real.at(-1) : bands[range.to - 1];
  const high = highFrom === undefined ? undefined : highFrom + step;
  const empty = [...counts.values()].every((count) => count === 0);
  return (
    <Group title={t("screens.search.filtersSheet.price")}>
      <View className="mb-3 flex-row items-baseline justify-between">
        <Text className="text-[20px] leading-[26px] font-semibold">
          {low === undefined || high === undefined
            ? t("screens.search.filtersSheet.anyPrice")
            : t("screens.search.filtersSheet.priceRange", {
                from: Math.round(low / 100),
                to: priceText(high, currency),
              })}
        </Text>
        <Text className="text-label text-ink-2">
          {axis && empty
            ? t("screens.search.filtersSheet.noResults")
            : t("screens.search.filtersSheet.perHour")}
        </Text>
      </View>
      {bands.length > 0 ? (
        <RangeBars
          counts={bands.map((from) => counts.get(from) ?? 0)}
          range={range}
          onChange={setRange}
        />
      ) : (
        <EmptyBars />
      )}
    </Group>
  );
});

const GroundSection = memo(function GroundSection({
  football,
  size,
  surfaces,
  settings,
  grounds,
  set,
}: {
  football: boolean;
  size: GroundSize | undefined;
  surfaces: Surface[];
  settings: Setting[];
  grounds: number | undefined;
  set: SetFilters;
}) {
  const { t } = useTranslation();
  return (
    <Group title={t("screens.search.filtersSheet.ground")}>
      {football ? (
        <>
          <Label first>{t("screens.search.filtersSheet.size")}</Label>
          <Pills>
            {FOOTBALL_SIZES.map((each) => (
              <Pill
                key={each}
                label={sizeName(each)}
                on={size === each}
                onPress={() => set({ size: size === each ? undefined : each })}
              />
            ))}
          </Pills>
        </>
      ) : null}
      <Label first={!football}>{t("screens.search.filtersSheet.surface")}</Label>
      <Pills>
        {SURFACES.map((surface) => (
          <Pill
            key={surface}
            label={surfaceName(surface)}
            on={surfaces.includes(surface)}
            onPress={() => set({ surfaces: toggled(surfaces, surface) })}
          />
        ))}
      </Pills>
      <Label>{t("screens.search.filtersSheet.setting")}</Label>
      <Pills>
        {SETTINGS.map((setting) => (
          <Pill
            key={setting}
            label={settingName(setting)}
            on={settings.includes(setting)}
            onPress={() => set({ settings: toggled(settings, setting) })}
          />
        ))}
      </Pills>
      <Label>{t("screens.search.filtersSheet.grounds")}</Label>
      <Pills>
        {GROUNDS.map((each) => (
          <Pill
            key={each ?? "any"}
            label={
              each
                ? t("screens.search.filtersSheet.atLeast", { value: each })
                : t("screens.search.filtersSheet.any")
            }
            on={grounds === each}
            onPress={() => set({ grounds: each })}
          />
        ))}
      </Pills>
    </Group>
  );
});

const VenueSection = memo(function VenueSection({
  amenities,
  picked,
  rating,
  set,
}: {
  amenities: Amenity[];
  picked: string[];
  rating: number | undefined;
  set: SetFilters;
}) {
  const { t } = useTranslation();
  return (
    <Group title={t("screens.search.filtersSheet.venue")}>
      <Pills>
        {amenities.map((amenity) => (
          <Pill
            key={amenity.id}
            label={amenity.name}
            icon={amenity.icon}
            on={picked.includes(amenity.id)}
            onPress={() => set({ amenities: toggled(picked, amenity.id) })}
          />
        ))}
      </Pills>
      <Label>{t("screens.search.filtersSheet.rating")}</Label>
      <Pills>
        {RATINGS.map((each) => (
          <Pill
            key={each ?? "any"}
            label={
              each
                ? t("screens.search.filtersSheet.atLeast", { value: each.toFixed(1) })
                : t("screens.search.filtersSheet.any")
            }
            on={rating === each}
            onPress={() => set({ rating: each })}
          />
        ))}
      </Pills>
    </Group>
  );
});

const BookingSection = memo(function BookingSection({
  instant,
  flexible,
  payment,
  loyalty,
  set,
}: {
  instant: boolean;
  flexible: boolean;
  payment: Payment | undefined;
  loyalty: boolean;
  set: SetFilters;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Group title={t("screens.search.filtersSheet.booking")}>
        <Toggle
          title={t("screens.search.filtersSheet.instant")}
          line={t("screens.search.filtersSheet.instantLine")}
          on={instant}
          onChange={(next) => set({ instant: next })}
        />
        <Toggle
          title={t("screens.search.filtersSheet.flexible")}
          line={t("screens.search.filtersSheet.flexibleLine")}
          on={flexible}
          onChange={(next) => set({ flexible: next })}
        />
        <Label>{t("screens.search.filtersSheet.pay")}</Label>
        <Pills>
          {PAYMENTS.map((each) => (
            <Pill
              key={each ?? "any"}
              label={t(
                each === "CASH"
                  ? "screens.search.filtersSheet.cash"
                  : each === "ONLINE"
                    ? "screens.search.filtersSheet.online"
                    : "screens.search.filtersSheet.any",
              )}
              on={payment === each}
              onPress={() => set({ payment: each })}
            />
          ))}
        </Pills>
      </Group>
      <Group title={t("screens.search.filtersSheet.perks")} last>
        <Toggle
          title={t("screens.search.filtersSheet.loyalty")}
          line={t("screens.search.filtersSheet.loyaltyLine")}
          on={loyalty}
          onChange={(next) => set({ loyalty: next })}
        />
      </Group>
    </>
  );
});

export function SearchFilters({
  visible,
  filters,
  sort,
  near,
  sport,
  params,
  currency,
  onApply,
  onClose,
}: {
  visible: boolean;
  filters: Filters;
  sort: SearchSort;
  // Whether the search is near the player, so Nearest can be picked.
  near: boolean;
  sport: Sport | undefined;
  // The search without its filters and order, for the count and the price chart.
  params: SearchParams;
  currency: string;
  onApply: (filters: Filters, sort: SearchSort) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState(filters);
  const [draftSort, setDraftSort] = useState(sort);
  useEffect(() => {
    if (!visible) return;
    setDraft(filters);
    setDraftSort(sort);
  }, [visible, filters, sort]);
  const set = useCallback<SetFilters>(
    (change) => setDraft((previous) => ({ ...previous, ...change })),
    [],
  );

  const amenities = useAmenities();
  const query = { ...params, ...filterQuery(draft) };
  const count = useVenueCount(query, visible);
  // The chart's axis: the search without filters, asked once per opening. Its bars: the search with
  // the other filters (the bands leave the price range out, so the handles never ask again).
  const base = useSpread(visible ? params : null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { priceMin, priceMax, ...unpriced } = query;
  const filtered = useSpread(visible ? unpriced : null);
  // Kept by value, so the memoised price section only redraws when they really change.
  const axisKey = base ? base.prices.map((band) => band.from).join(",") : null;
  const [axis, setAxis] = useState<number[] | null>(null);
  useEffect(() => {
    setAxis(axisKey === null ? null : axisKey.split(",").filter(Boolean).map(Number));
  }, [axisKey]);
  const countsKey = filtered ? JSON.stringify(filtered.prices) : "";
  const [counts, setCounts] = useState<Map<number, number>>(new Map());
  useEffect(() => {
    const prices = countsKey ? (JSON.parse(countsKey) as { from: number; venues: number }[]) : [];
    setCounts(new Map(prices.map((band) => [band.from, band.venues])));
  }, [countsKey]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      header={
        <Text className="text-subtitle font-semibold">
          {t("screens.search.filtersSheet.title")}
        </Text>
      }
      scrolls
    >
      <ScrollView
        style={{ maxHeight: height * 0.66 }}
        className="-mx-6 mt-4 border-t border-border"
        contentContainerClassName="px-6"
        showsVerticalScrollIndicator={false}
      >
        <SortSection sort={draftSort} near={near} onSort={setDraftSort} />
        <PriceSection
          axis={axis}
          counts={counts}
          priceMin={draft.priceMin}
          priceMax={draft.priceMax}
          currency={currency}
          set={set}
        />
        <GroundSection
          football={sport === "FOOTBALL"}
          size={draft.size}
          surfaces={draft.surfaces}
          settings={draft.settings}
          grounds={draft.grounds}
          set={set}
        />
        <VenueSection
          amenities={amenities}
          picked={draft.amenities}
          rating={draft.rating}
          set={set}
        />
        <BookingSection
          instant={draft.instant}
          flexible={draft.flexible}
          payment={draft.payment}
          loyalty={draft.loyalty}
          set={set}
        />
      </ScrollView>

      <View className="-mx-6 flex-row items-center justify-between gap-4 border-t border-border px-6 pt-4">
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          // Clears everything, the order back to best match, and closes on the cleared search.
          onPress={() => onApply(NO_FILTERS, "BEST_MATCH")}
          className="active:opacity-60"
        >
          <Text className="text-subtitle font-medium underline">
            {t("screens.search.filtersSheet.clearAll")}
          </Text>
        </Pressable>
        <View className="w-[200px]">
          <Button
            label={count === null ? t("common.showVenues") : t("common.showVenuesCount", { count })}
            size="small"
            // Nothing to show: grey, until a change finds something.
            disabled={count === 0}
            onPress={() => onApply(draft, draftSort)}
          />
        </View>
      </View>
    </Sheet>
  );
}
