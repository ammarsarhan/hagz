import type { components } from "@hagz/api";
import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Keyboard, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { formatDistance } from "@/lib/distance";
import {
  DEFAULT_RADIUS,
  MARKETPLACE,
  type SearchParams,
  useCoverage,
  useSpread,
  type VenueCard,
  type Where,
} from "@/lib/search";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { Button } from "./button";
import { IconBallFootball, IconChevronDown, IconMapPin, IconSearch, IconX } from "./icons";
import { RadiusSlider } from "./radius-slider";
import { Text } from "./text";

type Area = components["schemas"]["Area"];

// Where to look (Figma "C3 · Tabs & Search": the bar of option 4, 99:2, and C1, 135:2 and 136:2,
// the user's pick on 2026-11-20): the search bar opens this over Search. Near me, with a radius
// slider over bars of how many venues lie within each distance; or Pick an area, the governorates
// with live venues opening into their areas. Typing finds areas (either language, nearest first
// when the phone knows where it is) and venues by name. Never the whole country: a governorate at
// the widest.

const DEBOUNCE = 220;

function Row({
  icon,
  title,
  line,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  line?: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3.5 py-2.5 active:opacity-60"
    >
      <View className="size-11 items-center justify-center rounded-xl bg-chip">{icon}</View>
      <View className="shrink gap-0.5">
        <Text className="text-subtitle font-medium" numberOfLines={1}>
          {title}
        </Text>
        {line ? (
          <Text className="text-label text-ink-2" numberOfLines={1}>
            {line}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" className="mt-5 mb-1 text-[18px] leading-6 font-semibold">
      {children}
    </Text>
  );
}

function Segment({
  options,
  value,
  onChange,
}: {
  options: { key: "near" | "area"; label: string }[];
  value: "near" | "area";
  onChange: (key: "near" | "area") => void;
}) {
  return (
    <View className="mt-4 h-11 flex-row rounded-[14px] bg-chip p-1">
      {options.map((option) => {
        const on = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.key)}
            className={`flex-1 items-center justify-center rounded-[11px] ${on ? "bg-white" : ""}`}
            style={
              on
                ? {
                    shadowColor: "#0b0b0c",
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 1 },
                  }
                : undefined
            }
          >
            <Text className={`text-body ${on ? "font-medium text-ink" : "text-ink-2"}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={`h-10 justify-center rounded-full px-4 ${on ? "bg-ink" : "border border-border bg-white"}`}
    >
      <Text className={`text-body font-medium ${on ? "text-white" : "text-ink"}`}>{label}</Text>
    </Pressable>
  );
}

const venuesText = (count: number) => `${count} ${count === 1 ? "venue" : "venues"}`;

export function SearchWhere({
  here,
  where,
  params,
  onPick,
  onClose,
}: {
  here: { latitude: number; longitude: number } | null;
  where: Where;
  // The search without its where (when, sport, filters), for the radius bars.
  params: SearchParams;
  onPick: (where: Where) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [venues, setVenues] = useState<VenueCard[]>([]);
  // What the results on screen are for, so "no match" waits until the lookup for what's typed has
  // come back (not while it's still on its way).
  const [answered, setAnswered] = useState("");
  const [tab, setTab] = useState<"near" | "area">(here && where.kind === "near" ? "near" : "area");
  const [radius, setRadius] = useState(where.kind === "near" ? where.radius : DEFAULT_RADIUS);
  const coverage = useCoverage();
  // The governorate open: the one holding the area picked, else the first.
  const [open, setOpen] = useState<string | null>(null);
  const shownOpen =
    open ??
    (where.kind === "area"
      ? (coverage?.find(
          (governorate) =>
            governorate.id === where.id || governorate.areas.some((area) => area.id === where.id),
        )?.id ?? null)
      : (coverage?.[0]?.id ?? null));
  const spread = useSpread(
    here && tab === "near"
      ? { ...params, latitude: here.latitude, longitude: here.longitude, radius }
      : null,
  );
  const within = spread?.distances ?? null;
  const count = within?.[radius - 1] ?? null;
  useEffect(() => {
    const typed = q.trim();
    if (!typed) {
      setAreas([]);
      setVenues([]);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      const point = here ? { latitude: here.latitude, longitude: here.longitude } : {};
      void Promise.all([
        send(
          api.GET("/v1/marketplaces/{code}/areas", {
            params: { path: { code: MARKETPLACE }, query: { q: typed, limit: 5, ...point } },
          }),
        ),
        send(
          api.GET("/v1/venues", {
            params: { query: { marketplace: MARKETPLACE, q: typed, limit: 5 } },
          }),
        ),
      ]).then(([foundAreas, foundVenues]) => {
        if (!active) return;
        setAreas(foundAreas.ok ? foundAreas.data.data : []);
        setVenues(foundVenues.ok ? foundVenues.data.data : []);
        setAnswered(typed);
      });
    }, DEBOUNCE);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q, here]);

  const pick = (where: Where) => {
    Keyboard.dismiss();
    onPick(where);
  };

  return (
    <View className="flex-1 bg-white px-6" style={{ paddingTop: insets.top + 16 }}>
      <Text accessibilityRole="header" className="text-title font-semibold tracking-[-0.4px]">
        Search
      </Text>
      <View className="mt-4 h-[52px] flex-row items-center gap-3 rounded-full border-[1.5px] border-ink pr-3 pl-5">
        <IconSearch size={20} color={colors.ink} strokeWidth={2} />
        <TextInput
          autoFocus
          value={q}
          onChangeText={setQ}
          placeholder="An area or a venue"
          placeholderTextColor={colors.unit}
          selectionColor={colors.ink}
          returnKeyType="search"
          autoCorrect={false}
          className="flex-1 text-[18px] text-ink"
        />
        {/* Clears what's typed; with nothing typed, closes. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={q ? "Clear" : "Close"}
          hitSlop={10}
          onPress={() => (q ? setQ("") : onClose())}
          className="size-8 items-center justify-center active:opacity-60"
        >
          <IconX size={18} color={colors.ink2} strokeWidth={2} />
        </Pressable>
      </View>
      {q.trim() ? null : (
        <Segment
          options={[
            { key: "near", label: "Near me" },
            { key: "area", label: "Pick an area" },
          ]}
          value={tab}
          onChange={setTab}
        />
      )}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="pt-3 pb-10">
        {q.trim() ? null : tab === "near" ? (
          here ? (
            <Animated.View entering={FadeIn.duration(180)}>
              <View className="mt-3 flex-row items-baseline justify-between">
                <Text className="text-[20px] leading-[26px] font-semibold">Within {radius} km</Text>
                <Text className="text-label text-ink-2">
                  {count === null ? " " : venuesText(count)}
                </Text>
              </View>
              <Text className="mt-1 mb-3 text-caption text-unit">
                Bars depict venues within each distance
              </Text>
              <RadiusSlider radius={radius} within={within} onChange={setRadius} />
              <View className="mt-8">
                <Button
                  label={`Search within ${radius} km`}
                  size="small"
                  onPress={() => pick({ kind: "near", radius })}
                />
              </View>
            </Animated.View>
          ) : (
            <Text className="mt-6 text-subtitle text-ink-2">
              Turn on location for Hagz in Settings to search near you.
            </Text>
          )
        ) : (
          <Animated.View entering={FadeIn.duration(180)} layout={LinearTransition.duration(200)}>
            {(coverage ?? []).map((governorate) => {
              const expanded = governorate.id === shownOpen;
              return (
                <View key={governorate.id} className="border-b border-border py-4">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    onPress={() => setOpen(expanded ? "" : governorate.id)}
                    className="flex-row items-center justify-between active:opacity-60"
                  >
                    <View className="gap-0.5">
                      <Text className="text-subtitle font-medium">{governorate.name}</Text>
                      <Text className="text-caption text-ink-2">
                        {`${governorate.areas.length} ${governorate.areas.length === 1 ? "area" : "areas"} · ${venuesText(governorate.venues)}`}
                      </Text>
                    </View>
                    <View style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}>
                      <IconChevronDown size={20} color={colors.ink2} strokeWidth={2} />
                    </View>
                  </Pressable>
                  {expanded ? (
                    <Animated.View
                      entering={FadeIn.duration(180)}
                      className="mt-4 flex-row flex-wrap gap-2"
                    >
                      <Pill
                        label={`All of ${governorate.name ?? ""}`}
                        on={where.kind === "area" && where.id === governorate.id}
                        onPress={() =>
                          pick({
                            kind: "area",
                            id: governorate.id,
                            name: governorate.name ?? "",
                            within: null,
                          })
                        }
                      />
                      {governorate.areas.map((area) => (
                        <Pill
                          key={area.id}
                          label={area.name ?? ""}
                          on={where.kind === "area" && where.id === area.id}
                          onPress={() =>
                            pick({
                              kind: "area",
                              id: area.id,
                              name: area.name ?? "",
                              within: governorate.name,
                            })
                          }
                        />
                      ))}
                    </Animated.View>
                  ) : null}
                </View>
              );
            })}
          </Animated.View>
        )}
        {areas.length > 0 ? (
          <>
            <Heading>Areas</Heading>
            {areas.map((area) => (
              <Row
                key={area.id}
                icon={<IconMapPin size={20} color={colors.ink} strokeWidth={1.75} />}
                title={area.name ?? ""}
                line={area.within}
                onPress={() =>
                  pick({ kind: "area", id: area.id, name: area.name ?? "", within: area.within })
                }
              />
            ))}
          </>
        ) : null}
        {venues.length > 0 ? (
          <>
            <Heading>Venues</Heading>
            {venues.map((venue) => (
              <Row
                key={venue.id}
                icon={<IconBallFootball size={20} color={colors.ink} strokeWidth={1.75} />}
                title={venue.name ?? "Venue"}
                line={[venue.area, venue.distance === null ? null : formatDistance(venue.distance)]
                  .filter(Boolean)
                  .join(" · ")}
                onPress={() => {
                  Keyboard.dismiss();
                  router.push({ pathname: "/venue/[slug]", params: { slug: venue.slug } });
                }}
              />
            ))}
          </>
        ) : null}
        {q.trim() && answered === q.trim() && areas.length === 0 && venues.length === 0 ? (
          <Text className="mt-6 text-subtitle text-ink-2">
            No areas or venues match “{q.trim()}”.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
