import type { components } from "@hagz/api";
import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Keyboard, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { formatDistance } from "@/lib/distance";
import { MARKETPLACE, type VenueCard, type Where } from "@/lib/search";
import {
  IconBallFootball,
  IconCurrentLocation,
  IconMapPin,
  IconSearch,
  IconWorld,
  IconX,
} from "./icons";
import { Text } from "./text";

type Area = components["schemas"]["Area"];

// Where to look (Figma "C3 · Tabs & Search", option 4, 99:2): the search bar opens this over
// Search, keyboard up. Near me and the whole country first; typing finds areas (either language,
// nearest first when the phone knows where it is) and venues by name. An area or Near me is
// picked as the search's where; a venue opens its page.

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

export function SearchWhere({
  here,
  onPick,
  onClose,
}: {
  here: { latitude: number; longitude: number } | null;
  onPick: (where: Where) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [venues, setVenues] = useState<VenueCard[]>([]);

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
          className="flex-1 text-[20px] text-ink"
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
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="pt-3 pb-10">
        {here ? (
          <Row
            icon={<IconCurrentLocation size={20} color={colors.ink} strokeWidth={1.75} />}
            title="Near me"
            line="Venues within 10 km of you"
            onPress={() => pick({ kind: "near" })}
          />
        ) : null}
        <Row
          icon={<IconWorld size={20} color={colors.ink} strokeWidth={1.75} />}
          title="All of Egypt"
          line="Every venue, best rated first"
          onPress={() => pick({ kind: "everywhere" })}
        />
        {areas.length > 0 ? (
          <>
            <View className="mt-3 h-px bg-border" />
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
        {q.trim() && areas.length === 0 && venues.length === 0 ? (
          <Text className="mt-6 text-subtitle text-ink-2">
            No areas or venues match “{q.trim()}”.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
