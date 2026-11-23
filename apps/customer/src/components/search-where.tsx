import type { components } from "@hagz/api";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { formatDistance } from "@/lib/distance";
import { isRTL } from "@/lib/language";
import {
  DEFAULT_RADIUS,
  MARKETPLACE,
  type SearchParams,
  useCoverage,
  useSpread,
  type VenueCard,
  type Where,
} from "@/lib/search";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Button } from "./button";
import {
  IconBallFootball,
  IconChevronDown,
  IconClock,
  IconMapPin,
  IconSearch,
  IconX,
} from "./icons";
import { RadiusSlider } from "./radius-slider";
import { Text } from "./text";
import { Segment } from "./segment";
import { push } from "@/lib/navigation";
import { RoundButton } from "./nav";
import {
  clearRecentSearches,
  recentSearches,
  rememberSearch,
  type RecentSearch,
} from "@/lib/recent-searches";

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
          <Text className="text-caption text-ink-2" numberOfLines={1}>
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

// An accordion's body: its height opens from nothing to what it measures (and back), the chevron
// turning with it.
function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  const [measured, setMeasured] = useState(0);
  const shown = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(open ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [open, shown]);
  const body = useAnimatedStyle(() => ({
    height: shown.value * measured,
    opacity: interpolate(shown.value, [0, 0.5, 1], [0, 0.6, 1]),
  }));
  return (
    <Animated.View style={[{ overflow: "hidden" }, body]}>
      <View
        className="absolute top-0 right-0 left-0"
        onLayout={(event) => setMeasured(event.nativeEvent.layout.height)}
      >
        {children}
      </View>
    </Animated.View>
  );
}

function Chevron({ open }: { open: boolean }) {
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.value = withTiming(open ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [open, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  return (
    <Animated.View style={style}>
      <IconChevronDown size={20} color={colors.ink2} strokeWidth={2} />
    </Animated.View>
  );
}

function Pill({
  label,
  on,
  small = false,
  onPress,
}: {
  label: string;
  on: boolean;
  small?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={`justify-center rounded-full ${small ? "h-9 px-3.5" : "h-10 px-4"} ${on ? "bg-ink" : "border border-border bg-white"}`}
    >
      <Text
        className={`${small ? "text-label" : "text-body"} font-medium ${on ? "text-white" : "text-ink"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type Governorate = NonNullable<ReturnType<typeof useCoverage>>[number];

// A governorate's areas as pills, "All of …" first.
function AreaPills({
  governorate,
  where,
  onPick,
  small = false,
  className = "",
}: {
  governorate: Governorate;
  where: Where;
  onPick: (where: Where) => void;
  small?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <View className={`flex-row flex-wrap gap-2 ${className}`}>
      <Pill
        small={small}
        label={t("screens.search.where.allOf", { name: governorate.name ?? "" })}
        on={where.kind === "area" && where.id === governorate.id}
        onPress={() =>
          onPick({
            kind: "area",
            id: governorate.id,
            name: governorate.name ?? "",
            within: null,
          })
        }
      />
      {governorate.areas.map((area) => (
        <Pill
          small={small}
          key={area.id}
          label={area.name ?? ""}
          on={where.kind === "area" && where.id === area.id}
          onPress={() =>
            onPick({
              kind: "area",
              id: area.id,
              name: area.name ?? "",
              within: governorate.name,
            })
          }
        />
      ))}
    </View>
  );
}

export function SearchWhere({
  here,
  where,
  params,
  onPick,
  onClose,
  areasOnly = false,
}: {
  here: { latitude: number; longitude: number } | null;
  where: Where;
  // Home's where (user, 2026-11-23): only the areas to pick from, under "Pick an area" and a close
  // button; no search field, no Near me | Pick an area, no recents.
  areasOnly?: boolean;
  // The search without its where (when, sport, filters), for the radius bars.
  params: SearchParams;
  onPick: (where: Where) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [venues, setVenues] = useState<VenueCard[]>([]);
  // What the results on screen are for, so "no match" waits until the lookup for what's typed has
  // come back (not while it's still on its way).
  const [answered, setAnswered] = useState("");
  const [tab, setTab] = useState<"near" | "area">(
    !areasOnly && here && where.kind === "near" ? "near" : "area",
  );
  const [radius, setRadius] = useState(where.kind === "near" ? where.radius : DEFAULT_RADIUS);
  const coverage = useCoverage();
  // The governorate open: none until one's tapped, so the list never shifts as it arrives.
  const [open, setOpen] = useState<string | null>(null);
  // The bars leave the radius out, so moving the slider doesn't ask for them again.
  const spread = useSpread(
    here && tab === "near"
      ? { ...params, latitude: here.latitude, longitude: here.longitude }
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

  const [recents, setRecents] = useState<RecentSearch[]>(recentSearches);

  const pick = (where: Where) => {
    Keyboard.dismiss();
    if (where.kind === "area") rememberSearch(where);
    onPick(where);
  };

  const openVenue = (venue: { slug: string; name: string; line: string | null }) => {
    Keyboard.dismiss();
    rememberSearch({ kind: "venue", ...venue });
    setRecents(recentSearches());
    push({ pathname: "/venue/[slug]", params: { slug: venue.slug } });
  };

  // The page scrolls under the bar, which rides up with it and docks under the status bar, a white
  // header fading in behind it (the Search tab's pattern). Near me stays put: nothing to scroll.
  const typed = q.trim() !== "";
  const scrolls = typed || tab === "area";
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  useEffect(() => {
    if (!scrolls) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrolls, scrollRef]);
  const top = insets.top + 16;
  const barStart = useSharedValue(top + 50);
  const dockAt = insets.top + 6;
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(dockAt, barStart.value - scrollY.value) }],
  }));
  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(barStart.value - scrollY.value, [dockAt + 24, dockAt], [0, 1], "clamp"),
  }));

  return (
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollEnabled={scrolls}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: top, paddingBottom: 40 }}
      >
        {areasOnly ? (
          <View className="flex-row items-center justify-between gap-4">
            <Text
              accessibilityRole="header"
              className="shrink text-title font-semibold tracking-[-0.4px]"
            >
              {t("screens.search.where.pickArea")}
            </Text>
            <RoundButton icon={IconX} label={t("components.nav.close")} onPress={onClose} />
          </View>
        ) : (
          <>
            <Text accessibilityRole="header" className="text-title font-semibold tracking-[-0.4px]">
              {t("screens.search.title")}
            </Text>
            {/* The bar's slot: the bar floats over it, so it can dock. */}
            <View
              className="mt-4 h-[52px]"
              onLayout={(event) => {
                // Measured in the content, which already has the top padding.
                barStart.value = event.nativeEvent.layout.y;
              }}
            />
          </>
        )}
        {typed || areasOnly ? null : (
          <Segment
            className="mt-4"
            options={[
              { key: "near", label: t("screens.search.where.nearMe") },
              { key: "area", label: t("screens.search.where.pickArea") },
            ]}
            value={tab}
            onChange={setTab}
          />
        )}
        {/* Recent picks: one row of chips under the switcher, so it never moves. */}
        {!typed && !areasOnly && recents.length > 0 ? (
          <Animated.View exiting={FadeOut.duration(200)}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              className="-mx-6 mt-3"
              contentContainerClassName="items-center gap-2 px-6"
            >
              {recents.map((recent) => (
                <Pressable
                  key={recent.kind === "area" ? recent.id : recent.slug}
                  accessibilityRole="button"
                  accessibilityHint={
                    recent.kind === "area"
                      ? (recent.within ?? undefined)
                      : (recent.line ?? undefined)
                  }
                  onPress={() => (recent.kind === "area" ? pick(recent) : openVenue(recent))}
                  className="h-9 flex-row items-center gap-1.5 rounded-full border border-border px-3.5 active:opacity-60"
                >
                  <IconClock size={15} color={colors.ink2} strokeWidth={1.75} />
                  <Text className="text-label font-medium" numberOfLines={1}>
                    {recent.name}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  clearRecentSearches();
                  setRecents([]);
                }}
                className="px-1.5 active:opacity-60"
              >
                <Text className="text-label font-medium text-ink-2 underline">
                  {t("screens.search.where.clearRecent")}
                </Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        ) : null}
        <Animated.View className="pt-3" layout={LinearTransition.duration(200)}>
          {typed ? null : tab === "near" ? (
            <Animated.View key="near" entering={FadeIn.duration(220)}>
              {here ? (
                <>
                  <View className="mt-3 flex-row items-baseline justify-between">
                    <Text className="text-[20px] leading-[26px] font-semibold">
                      {t("screens.search.where.within", { km: radius })}
                    </Text>
                    <Text className="text-label text-ink-2">
                      {count === null ? " " : t("formats.venues", { count })}
                    </Text>
                  </View>
                  <Text className="mt-1 mb-6 text-caption text-unit">
                    {t("screens.search.where.barsHint")}
                  </Text>
                  <RadiusSlider radius={radius} within={within} onChange={setRadius} />
                  <View className="mt-8">
                    <Button
                      label={t("common.searchWithin", { km: radius })}
                      size="small"
                      onPress={() => pick({ kind: "near", radius })}
                    />
                  </View>
                </>
              ) : (
                <Text className="mt-6 text-subtitle text-ink-2">
                  {t("screens.search.where.locationOff")}
                </Text>
              )}
            </Animated.View>
          ) : (
            <Animated.View key="area" entering={FadeIn.duration(220)}>
              {/* Only one governorate (user, 2026-11-23): its areas straight away, a size
                  smaller, with nothing to open. */}
              {coverage?.length === 1 && coverage[0] ? (
                <AreaPills
                  governorate={coverage[0]}
                  where={where}
                  onPick={pick}
                  small
                  className="pt-5"
                />
              ) : null}
              {(coverage?.length === 1 ? [] : (coverage ?? [])).map((governorate) => {
                const expanded = governorate.id === open;
                return (
                  <View key={governorate.id} className="border-b border-border py-4">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      onPress={() => setOpen(expanded ? null : governorate.id)}
                      className="flex-row items-center justify-between active:opacity-60"
                    >
                      <View className="gap-0.5">
                        <Text className="text-subtitle font-medium">{governorate.name}</Text>
                        <Text className="text-caption text-ink-2">
                          {`${t("screens.search.where.areas", { count: governorate.areas.length })} · ${t("formats.venues", { count: governorate.venues })}`}
                        </Text>
                      </View>
                      <Chevron open={expanded} />
                    </Pressable>
                    <Collapsible open={expanded}>
                      <AreaPills
                        governorate={governorate}
                        where={where}
                        onPick={pick}
                        className="pt-4"
                      />
                    </Collapsible>
                  </View>
                );
              })}
            </Animated.View>
          )}
          {areas.length > 0 ? (
            <>
              <Heading>{t("screens.search.where.areasHeading")}</Heading>
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
              <Heading>{t("screens.search.where.venuesHeading")}</Heading>
              {venues.map((venue) => (
                <Row
                  key={venue.id}
                  icon={<IconBallFootball size={20} color={colors.ink} strokeWidth={1.75} />}
                  title={venue.name ?? t("screens.venue.fallbackName")}
                  line={[
                    venue.area,
                    venue.distance === null ? null : formatDistance(venue.distance),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  onPress={() =>
                    openVenue({
                      slug: venue.slug,
                      name: venue.name ?? t("screens.venue.fallbackName"),
                      line: venue.area,
                    })
                  }
                />
              ))}
            </>
          ) : null}
          {q.trim() && answered === q.trim() && areas.length === 0 && venues.length === 0 ? (
            <Text className="mt-6 text-subtitle text-ink-2">
              {t("screens.search.where.noMatch", { query: q.trim() })}
            </Text>
          ) : null}
        </Animated.View>
      </Animated.ScrollView>

      {/* The header the bar docks in, and the bar itself. */}
      {areasOnly ? null : (
        <>
          <Animated.View
            pointerEvents="none"
            className="absolute top-0 right-0 left-0 border-b border-hairline bg-white"
            style={[{ height: dockAt + 52 + 10 }, headerStyle]}
          />
          <Animated.View className="absolute top-0 right-6 left-6" style={barStyle}>
            <View className="h-[52px] flex-row items-center gap-3 rounded-full border-[1.5px] border-ink bg-white pr-3 pl-5">
              <IconSearch size={20} color={colors.ink} strokeWidth={2} />
              <TextInput
                autoFocus
                value={q}
                onChangeText={setQ}
                placeholder={t("screens.search.where.placeholder")}
                placeholderTextColor={colors.unit}
                selectionColor={colors.ink}
                returnKeyType="search"
                autoCorrect={false}
                className="flex-1 text-[18px] text-ink"
              />
              {/* Clears what's typed; with nothing typed, closes. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={q ? t("screens.search.where.clear") : t("components.nav.close")}
                hitSlop={10}
                onPress={() => (q ? setQ("") : onClose())}
                className="size-8 items-center justify-center active:opacity-60"
              >
                <IconX size={18} color={colors.ink2} strokeWidth={2} />
              </Pressable>
            </View>
          </Animated.View>
        </>
      )}
    </View>
  );
}
