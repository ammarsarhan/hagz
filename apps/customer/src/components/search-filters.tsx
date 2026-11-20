import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Switch, useWindowDimensions, View } from "react-native";
import { colors } from "@/lib/colors";
import {
  filterQuery,
  type Filters,
  type GroundSize,
  NO_FILTERS,
  type Payment,
  priceText,
  SETTING_NAMES,
  type SearchParams,
  type SearchSort,
  type Setting,
  SIZE_NAMES,
  type Sport,
  SURFACE_NAMES,
  type Surface,
  useAmenities,
  useSpread,
  useVenueCount,
} from "@/lib/search";
import { AmenityIcon } from "./amenity-icon";
import { Button } from "./button";
import { RangeBars, type Range } from "./range-bars";
import { Sheet } from "./sheet";
import { Text } from "./text";

// Filters (Figma "C3 · Tabs & Search" A1, 127:2 and 128:2; the user's pick on 2026-11-20): one long
// sheet from the search bar's round button. Sort, the price per hour as a range over a chart of how
// many venues charge each (the When sheet's language), the ground, the venue, how booking works,
// perks. A draft, applied with Show N venues, which counts it as it changes; Clear all empties it.

const SORTS: { sort: SearchSort; label: string; near?: boolean }[] = [
  { sort: "BEST_MATCH", label: "Best match" },
  { sort: "DISTANCE", label: "Nearest", near: true },
  { sort: "PRICE", label: "Price" },
  { sort: "RATING", label: "Rating" },
  { sort: "SOONEST", label: "Soonest" },
];
const FOOTBALL_SIZES: GroundSize[] = ["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"];
const SURFACES: Surface[] = ["ARTIFICIAL_TURF", "NATURAL_GRASS", "HARD_COURT", "HARD_WOOD", "SAND"];
const SETTINGS: Setting[] = ["INDOOR", "OUTDOOR", "COVERED"];
const GROUNDS = [undefined, 2, 3, 5];
const RATINGS = [undefined, 4, 4.5];
const PAYMENTS: (Payment | undefined)[] = [undefined, "CASH", "ONLINE"];

export const SORT_NAMES: Record<SearchSort, string> = {
  BEST_MATCH: "Best match",
  DISTANCE: "Nearest",
  PRICE: "Cheapest",
  RATING: "Best rated",
  SOONEST: "Soonest",
};

function Pill({
  label,
  on,
  icon,
  onPress,
}: {
  label: string;
  on: boolean;
  icon?: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={`h-10 flex-row items-center gap-1.5 rounded-full px-4 ${on ? "bg-ink" : "border border-border bg-white"}`}
    >
      {icon}
      <Text className={`text-body font-medium ${on ? "text-white" : "text-ink"}`}>{label}</Text>
    </Pressable>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="border-b border-border py-6">
      <Text accessibilityRole="header" className="mb-3 text-[18px] leading-6 font-semibold">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text className="mt-4 mb-2 text-label text-ink-2 first:mt-0">{children}</Text>;
}

function Pills({ children }: { children: ReactNode }) {
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

const toggled = <T,>(list: T[], item: T) =>
  list.includes(item) ? list.filter((each) => each !== item) : [...list, item];

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
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState(filters);
  const [draftSort, setDraftSort] = useState(sort);
  useEffect(() => {
    if (!visible) return;
    setDraft(filters);
    setDraftSort(sort);
  }, [visible, filters, sort]);
  const set = (change: Partial<Filters>) => setDraft((previous) => ({ ...previous, ...change }));

  const amenities = useAmenities();
  const query = { ...params, ...filterQuery(draft) };
  const count = useVenueCount(query, visible);
  const spread = useSpread(visible ? query : null);
  const bands = spread?.prices ?? [];
  const step = bands.length > 1 ? (bands[1]?.from ?? 0) - (bands[0]?.from ?? 0) : 5000;
  // The range over the bands: the whole chart when no price is set.
  const bandOf = (price: number) =>
    Math.max(
      0,
      bands.findIndex((band) => band.from + step > price),
    );
  const range: Range = {
    from: draft.priceMin === undefined ? 0 : bandOf(draft.priceMin),
    to: draft.priceMax === undefined ? bands.length : bandOf(draft.priceMax) + 1,
  };
  const setRange = (next: Range) => {
    const whole = next.from === 0 && next.to === bands.length;
    set(
      whole
        ? { priceMin: undefined, priceMax: undefined }
        : {
            priceMin: next.from === 0 ? undefined : bands[next.from]?.from,
            priceMax: next.to === bands.length ? undefined : (bands[next.to]?.from ?? 0) - 1,
          },
    );
  };
  const low = bands[range.from]?.from;
  const high = bands[range.to - 1] ? (bands[range.to - 1]?.from ?? 0) + step : undefined;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      header={<Text className="text-subtitle font-semibold">Filters</Text>}
    >
      <ScrollView
        style={{ maxHeight: height * 0.66 }}
        className="-mx-6 border-t border-border"
        contentContainerClassName="px-6"
        showsVerticalScrollIndicator={false}
      >
        <Group title="Sort by">
          <Pills>
            {SORTS.filter((each) => !each.near || near).map((each) => (
              <Pill
                key={each.sort}
                label={each.label}
                on={draftSort === each.sort}
                onPress={() => setDraftSort(each.sort)}
              />
            ))}
          </Pills>
        </Group>

        <Group title="Price per hour">
          <View className="mb-3 flex-row items-baseline justify-between">
            <Text className="text-[20px] leading-[26px] font-semibold">
              {low === undefined || high === undefined
                ? "Any price"
                : `${Math.round(low / 100)} – ${priceText(high, currency)}`}
            </Text>
            <Text className="text-label text-ink-2">per hour</Text>
          </View>
          {bands.length > 0 ? (
            <RangeBars
              counts={bands.map((band) => band.venues)}
              range={range}
              onChange={setRange}
            />
          ) : (
            <View style={{ height: 90 }} />
          )}
        </Group>

        <Group title="Ground">
          {sport === "FOOTBALL" ? (
            <>
              <Label>Size</Label>
              <Pills>
                {FOOTBALL_SIZES.map((size) => (
                  <Pill
                    key={size}
                    label={SIZE_NAMES[size]}
                    on={draft.size === size}
                    onPress={() => set({ size: draft.size === size ? undefined : size })}
                  />
                ))}
              </Pills>
            </>
          ) : null}
          <Label>Surface</Label>
          <Pills>
            {SURFACES.map((surface) => (
              <Pill
                key={surface}
                label={SURFACE_NAMES[surface]}
                on={draft.surfaces.includes(surface)}
                onPress={() => set({ surfaces: toggled(draft.surfaces, surface) })}
              />
            ))}
          </Pills>
          <Label>Setting</Label>
          <Pills>
            {SETTINGS.map((setting) => (
              <Pill
                key={setting}
                label={SETTING_NAMES[setting]}
                on={draft.settings.includes(setting)}
                onPress={() => set({ settings: toggled(draft.settings, setting) })}
              />
            ))}
          </Pills>
          <Label>Grounds at the venue</Label>
          <Pills>
            {GROUNDS.map((grounds) => (
              <Pill
                key={grounds ?? "any"}
                label={grounds ? `${grounds}+` : "Any"}
                on={draft.grounds === grounds}
                onPress={() => set({ grounds })}
              />
            ))}
          </Pills>
        </Group>

        <Group title="Venue">
          <Pills>
            {amenities.map((amenity) => {
              const on = draft.amenities.includes(amenity.id);
              return (
                <Pill
                  key={amenity.id}
                  label={amenity.name}
                  on={on}
                  icon={
                    <AmenityIcon
                      name={amenity.icon}
                      size={16}
                      color={on ? colors.white : colors.ink}
                    />
                  }
                  onPress={() => set({ amenities: toggled(draft.amenities, amenity.id) })}
                />
              );
            })}
          </Pills>
          <Label>Rating</Label>
          <Pills>
            {RATINGS.map((rating) => (
              <Pill
                key={rating ?? "any"}
                label={rating ? `${rating.toFixed(1)}+` : "Any"}
                on={draft.rating === rating}
                onPress={() => set({ rating })}
              />
            ))}
          </Pills>
        </Group>

        <Group title="Booking">
          <Toggle
            title="Instant confirmation"
            line="Booked without waiting for the venue"
            on={draft.instant}
            onChange={(instant) => set({ instant })}
          />
          <Toggle
            title="Flexible cancellation"
            line="Your money back up to 24 hours before"
            on={draft.flexible}
            onChange={(flexible) => set({ flexible })}
          />
          <Label>Pay</Label>
          <Pills>
            {PAYMENTS.map((payment) => (
              <Pill
                key={payment ?? "any"}
                label={payment === "CASH" ? "Cash" : payment === "ONLINE" ? "Online" : "Any"}
                on={draft.payment === payment}
                onPress={() => set({ payment })}
              />
            ))}
          </Pills>
        </Group>

        <View className="py-6">
          <Text accessibilityRole="header" className="mb-1 text-[18px] leading-6 font-semibold">
            Perks
          </Text>
          <Toggle
            title="Loyalty"
            line="Free bookings for regulars"
            on={draft.loyalty}
            onChange={(loyalty) => set({ loyalty })}
          />
        </View>
      </ScrollView>

      <View className="-mx-6 flex-row items-center justify-between gap-4 border-t border-border px-6 pt-4">
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setDraft(NO_FILTERS)}
          className="active:opacity-60"
        >
          <Text className="text-subtitle font-medium underline">Clear all</Text>
        </Pressable>
        <View className="w-[200px]">
          <Button
            label={
              count === null ? "Show venues" : `Show ${count} ${count === 1 ? "venue" : "venues"}`
            }
            size="small"
            onPress={() => onApply(draft, draftSort)}
          />
        </View>
      </View>
    </Sheet>
  );
}
