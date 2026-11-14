import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { MAP_PIN, MAP_PIN_SIZE } from "@/assets/map-art";
import { AreaPicker } from "@/components/area-picker";
import { Button } from "@/components/button";
import { useHud } from "@/components/hud";
import { IconCircleCheckFilled, IconChevronLeft, IconMapPin, IconSearch } from "@/components/icons";
import { PlaceSearch } from "@/components/place-search";
import { Text } from "@/components/text";
import { areaLabel, matchArea, type Location } from "@/lib/areas";
import { api } from "@/lib/api";
import { hudMessage, problem, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { addressAt, type Coordinates, type Place } from "@/lib/places";
import { queries, reference } from "@/lib/queries";

// Adding a venue, step 3 (Figma "Venue creation · 3 Find your venue", 282:2, "· 5 Adjust the pin",
// 283:2 and "Confirm the area · B", 295:2): one full-screen map the owner never leaves, with the
// card at the bottom changing as they go.
//
//   find  search for the venue, use their own position, or just move the map to it
//   pin   the pin sits in the middle of the map and the map moves under it, so a pitch down an
//         unnamed lane can still be placed exactly; the address follows it
//   area  the area we matched from the address, to confirm or change, then the draft is created
//
// Players browse by area and drive to the pin, so both have to be right, and only the owner knows.
type Stage = "find" | "pin" | "area";

// Where the map opens before it knows better: Cairo, wide enough to see which part of it you're in.
const START: Region = {
  latitude: 30.0444,
  longitude: 31.2357,
  latitudeDelta: 0.22,
  longitudeDelta: 0.22,
};
// Close enough to pick out a gate once a venue has been found.
const CLOSE = { latitudeDelta: 0.004, longitudeDelta: 0.004 };
// After the map stops moving, before asking Google what's under the pin.
const SETTLE_MS = 500;
// Hagz's only marketplace for now; a pin abroad is turned away by the API.
const FALLBACK_COUNTRY = "EG";

// Google Maps on both platforms: it's the map people in Egypt and the Gulf read, and it knows the
// pitches, compounds and street names Apple Maps doesn't. Its SDK is compiled into the app with a
// key per platform (app.config.ts).

export default function CreateVenuePlace() {
  const { t } = useTranslation();
  const { name = "" } = useLocalSearchParams<{ name: string }>();
  const insets = useSafeAreaInsets();
  const hud = useHud();
  const queryClient = useQueryClient();
  const map = useRef<MapView>(null);

  const [stage, setStage] = useState<Stage>("find");
  const [searching, setSearching] = useState(false);
  const [choosingArea, setChoosingArea] = useState(false);
  const [creating, setCreating] = useState(false);
  // The point under the pin: the middle of the map, wherever it has been moved to.
  const [pin, setPin] = useState<Coordinates>(START);
  // Google's answer for that point, or for the place that was picked.
  const [place, setPlace] = useState<Place | null>(null);
  const [locating, setLocating] = useState(false);
  // Until the map has been moved or a place picked, there's nothing to continue to.
  const [placed, setPlaced] = useState(false);
  const [nudged, setNudged] = useState(false);
  const [chosenArea, setChosenArea] = useState<Location | null>(null);
  // How tall the bottom card is, so the map's middle (and the pin) sits above it.
  const [cardHeight, setCardHeight] = useState(0);

  const country = place?.country ?? FALLBACK_COUNTRY;
  const marketplaces = useQuery(reference.marketplaces);
  const locations = useQuery({
    ...reference.locations(country),
    enabled: stage === "area",
  });

  // The area the address falls in, which the owner confirms or changes.
  const suggested = useMemo(
    () => (place && locations.data ? matchArea(place.parts, locations.data) : null),
    [place, locations.data],
  );
  const area = chosenArea ?? suggested;
  const label = area && locations.data ? areaLabel(area, locations.data) : null;

  const moveTo = useCallback((coordinates: Coordinates) => {
    setPin(coordinates);
    map.current?.animateToRegion({ ...coordinates, ...CLOSE }, 400);
  }, []);

  // What's under the pin, once the map has settled. Only while the pin is being placed: the picked
  // place already came with an address, and by the area step nothing moves any more.
  useEffect(() => {
    if (stage !== "pin" || !placed) return;
    let dropped = false;
    setLocating(true);
    const timer = setTimeout(() => {
      addressAt(pin)
        .then((found) => {
          if (!dropped) setPlace(found);
        })
        .catch((error: unknown) => {
          console.warn(error);
          // The address is only a label here; the pin is what the venue is created with.
          if (!dropped) setPlace({ address: "", coordinates: pin, parts: [] });
        })
        .finally(() => {
          if (!dropped) setLocating(false);
        });
    }, SETTLE_MS);
    return () => {
      dropped = true;
      clearTimeout(timer);
    };
  }, [stage, placed, pin]);

  const pickedPlace = (found: Place) => {
    setSearching(false);
    setPlace(found);
    setPlaced(true);
    setChosenArea(null);
    moveTo(found.coordinates);
    setStage("pin");
  };

  const back = () => {
    if (stage === "area") return setStage("pin");
    if (stage === "pin") return setStage("find");
    router.back();
  };

  const toArea = () => {
    const active = marketplaces.data?.some((marketplace) => marketplace.code === country);
    // Somewhere Hagz hasn't opened yet: say so here rather than as a 422 after the last step.
    if (marketplaces.data && !active) {
      hud.show(t("screens.createVenue.place.outsideMarketplaces"));
      return;
    }
    setStage("area");
  };

  // The checklist takes the flow's place rather than stacking on top of it: there's no going back
  // to the map once the draft exists, and closing the checklist lands on first run.
  const openSetup = (venueId: string) => {
    if (router.canDismiss()) router.dismissAll();
    router.push({ pathname: "/setup/[venueId]", params: { venueId } });
  };

  const create = async () => {
    if (!area) return;
    setCreating(true);
    const result = await send(
      api.POST("/v1/staff/venues", {
        body: {
          name,
          coordinates: pin,
          ...(place?.placeId ? { placeId: place.placeId } : {}),
          locationId: area.id,
        },
      }),
    );
    setCreating(false);
    if (!result.ok) {
      const failure = problem(result.error);
      // They already have a venue they haven't finished: that's the one to go back to, not a
      // second one. The API says which.
      const existing = failure?.code === "UNFINISHED_VENUE_EXISTS" ? failure.venueId : undefined;
      if (typeof existing === "string") openSetup(existing);
      hud.show(hudMessage(result.error));
      return;
    }
    // The checklist is in hand already, so its screen opens with it rather than a spinner, and the
    // venues list is stale now that there's a draft on it.
    queryClient.setQueryData(queries.setup(result.data.venue.id).queryKey, result.data);
    void queryClient.invalidateQueries({ queryKey: queries.venues.queryKey });
    openSetup(result.data.venue.id);
  };

  return (
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <StatusBar style="dark" />
      <MapView
        ref={map}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={START}
        // The card covers the bottom, so the map's middle — and the pin — sits above it.
        mapPadding={{ top: 0, right: 0, bottom: cardHeight, left: 0 }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        scrollEnabled={stage !== "area"}
        zoomEnabled={stage !== "area"}
        rotateEnabled={false}
        pitchEnabled={false}
        onRegionChangeComplete={(region, details) => {
          setPin({ latitude: region.latitude, longitude: region.longitude });
          if (details?.isGesture === false) return;
          setPlaced(true);
          setNudged(true);
          // Moving the map by hand at the first step is a way of saying "it's here".
          if (stage === "find") setStage("pin");
        }}
      />

      <PinOverlay
        bottom={cardHeight}
        top={insets.top}
        visible={stage !== "find"}
        hint={stage === "pin" && !nudged ? t("screens.createVenue.place.movePin") : null}
      />

      {/* The controls float over the map: back, and what the map is showing. */}
      <View
        className="absolute inset-x-5 flex-row items-center gap-2.5"
        style={{ top: insets.top + 8 }}
      >
        <FloatingButton label={t("components.shared.nav.back")} onPress={back}>
          <IconChevronLeft
            size={20}
            color={colors.ink}
            strokeWidth={2}
            style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
          />
        </FloatingButton>
        {stage === "area" ? null : (
          <Pressable
            accessibilityRole="search"
            onPress={() => setSearching(true)}
            className="h-11 flex-1 flex-row items-center gap-2.5 rounded-full bg-white px-4 active:opacity-80"
            style={shadow}
          >
            {stage === "find" ? (
              <>
                <IconSearch size={20} color={colors.ink3} />
                <Text className="text-body text-ink-2" numberOfLines={1}>
                  {t("screens.createVenue.place.searchPlaceholder")}
                </Text>
              </>
            ) : (
              <>
                <IconMapPin size={20} color={colors.ink} />
                {locating ? (
                  <ActivityIndicator size="small" color={colors.ink3} />
                ) : (
                  <Text className="flex-1 text-label font-medium" numberOfLines={1}>
                    {place?.address || t("screens.createVenue.place.pinnedHere")}
                  </Text>
                )}
              </>
            )}
          </Pressable>
        )}
      </View>

      <View
        className="absolute inset-x-0 bottom-0 rounded-t-sheet bg-white px-5 pt-10"
        style={{ paddingBottom: insets.bottom + 26, ...cardShadow }}
        onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
      >
        {stage === "area" ? (
          <AreaStep
            label={label}
            loading={locations.isPending}
            creating={creating}
            onChange={() => setChoosingArea(true)}
            onConfirm={() => void create()}
          />
        ) : (
          <Step
            title={
              stage === "find"
                ? t("screens.createVenue.place.findTitle", { name })
                : t("screens.createVenue.place.pinTitle")
            }
            body={
              stage === "find"
                ? t("screens.createVenue.place.findBody")
                : t("screens.createVenue.place.pinBody")
            }
            action={t("common.actions.continue")}
            disabled={stage === "find" ? !placed : locating}
            onPress={() => (stage === "find" ? setStage("pin") : toArea())}
          />
        )}
      </View>

      <PlaceSearch
        visible={searching}
        near={pin}
        onClose={() => setSearching(false)}
        onPick={pickedPlace}
        onDropPin={() => {
          setSearching(false);
          setPlaced(true);
          setStage("pin");
        }}
      />
      <AreaPicker
        visible={choosingArea}
        locations={locations.data ?? []}
        selected={area}
        onClose={() => setChoosingArea(false)}
        onPick={(picked) => {
          setChosenArea(picked);
          setChoosingArea(false);
        }}
      />
    </View>
  );
}

// The white float the map's controls sit on.
const shadow = {
  shadowColor: "#0b0b0c",
  shadowOpacity: 0.14,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
} as const;

const cardShadow = {
  shadowColor: "#0b0b0c",
  shadowOpacity: 0.1,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: -6 },
  elevation: 12,
} as const;

function FloatingButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="size-11 items-center justify-center rounded-full bg-white active:opacity-80"
      style={shadow}
    >
      {children}
    </Pressable>
  );
}

// The pin doesn't move; the map does. It's drawn over the middle of the map's visible part (what
// the card doesn't cover), with its point on the spot and a shadow under it, so what's being
// placed is obvious even as the map slides about underneath.
function PinOverlay({
  bottom,
  top,
  visible,
  hint,
}: {
  bottom: number;
  top: number;
  visible: boolean;
  hint: string | null;
}) {
  if (!visible) return null;
  return (
    <View
      pointerEvents="none"
      className="absolute inset-x-0 items-center"
      style={{ top, bottom, justifyContent: "center" }}
    >
      <View className="items-center">
        <SvgXml xml={MAP_PIN} width={MAP_PIN_SIZE.width} height={MAP_PIN_SIZE.height} />
        {/* The ground under the point. */}
        <View className="-mt-0.5 h-1 w-2.5 rounded-full bg-ink/30" />
        {hint ? (
          <View className="mt-2.5 rounded-hud bg-ink px-3.5 py-2">
            <Text className="text-caption font-medium text-white">{hint}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// The card's usual shape: what this step is for, and one button on.
function Step({
  title,
  body,
  action,
  disabled,
  onPress,
}: {
  title: string;
  body: string;
  action: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <>
      <Text accessibilityRole="header" className="px-1 text-title font-semibold tracking-[-0.4px]">
        {title}
      </Text>
      <Text className="mb-5 mt-1.5 px-1 text-subtitle text-ink-2">{body}</Text>
      <Button label={action} disabled={disabled} onPress={onPress} />
    </>
  );
}

// The last card: the area we matched, to confirm or change. With no match (an address Google
// writes differently, or a part of town we haven't seeded) it asks instead of guessing.
function AreaStep({
  label,
  loading,
  creating,
  onChange,
  onConfirm,
}: {
  label: { name: string; within: string } | null;
  loading: boolean;
  creating: boolean;
  onChange: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Text accessibilityRole="header" className="px-1 text-title font-semibold tracking-[-0.4px]">
        {label
          ? t("screens.createVenue.place.areaTitle", { area: label.name })
          : t("screens.createVenue.place.areaUnknownTitle")}
      </Text>
      <Text className="mb-5 mt-1.5 px-1 text-subtitle text-ink-2">
        {t("screens.createVenue.place.areaBody")}
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={onChange}
        disabled={loading}
        className="flex-row items-center justify-between rounded-[16px] border border-primary bg-blue-tint p-4 active:opacity-80"
      >
        {loading ? (
          <ActivityIndicator color={colors.ink3} />
        ) : (
          <>
            <View className="flex-1">
              <Text className="text-[20px] font-semibold leading-[1.3] tracking-[-0.2px]">
                {label?.name ?? t("screens.createVenue.place.chooseArea")}
              </Text>
              {label?.within ? (
                <Text className="mt-0.5 text-body text-ink-2">{label.within}</Text>
              ) : null}
            </View>
            {label ? <IconCircleCheckFilled size={20} color={colors.primary} /> : null}
          </>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={onChange}
        hitSlop={8}
        className="items-center pb-[18px] pt-4 active:opacity-60"
      >
        <Text className="text-body font-medium text-primary">
          {t("screens.createVenue.place.differentArea")}
        </Text>
      </Pressable>

      <Button
        label={t("screens.createVenue.place.create")}
        disabled={!label}
        loading={creating}
        onPress={onConfirm}
      />
    </>
  );
}
