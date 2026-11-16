import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AreaPicker, type Area } from "@/components/area-picker";
import { Button } from "@/components/button";
import { useHudAnchor } from "@/components/hud";
import { IconX } from "@/components/icons";
import { RequestAreaSheet } from "@/components/request-area-sheet";
import { SetupLoading } from "@/components/setup-loading";
import { Text } from "@/components/text";
import { AreaCard, CardLink, cardShadow, FloatingButton, PinOverlay } from "@/components/venue-map";
import { api } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import type { Coordinates } from "@/lib/places";
import { areas, queries } from "@/lib/queries";
import { useSaveVenue, type VenueDetail } from "@/lib/venue-edit";

// Setup item "Location" (Figma "Setup · Location", 433:3). The pin was placed when the venue was
// added, so this opens on it: the map moves under a fixed pin, as it did then, with the area it's
// listed under in the card below. Moving the pin suggests the area nearest it again, unless one was
// picked by hand.
//
// A draft can ask for an area Hagz doesn't cover yet, as when it was added: by typing its name in
// the picker, or from Request coverage under the card. A listed venue can't (UpdateVenue): it must
// stay findable under an area, so it picks from the list only. A venue still waiting on its
// requested area keeps it until an area is chosen.
const CLOSE = { latitudeDelta: 0.004, longitudeDelta: 0.004 };

export default function SetupLocation() {
  const { venueId = "" } = useLocalSearchParams<{ venueId: string }>();
  const venue = useQuery(queries.venue(venueId));
  if (!venue.data) return <SetupLoading query={venue} />;
  return <LocationMap venueId={venueId} venue={venue.data} />;
}

function LocationMap({ venueId, venue }: { venueId: string; venue: VenueDetail }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { save, saving } = useSaveVenue(venueId);
  const map = useRef<MapView>(null);
  // A venue always has its pin; the fallback only keeps the types honest.
  const start: Coordinates = venue.location.coordinates ?? {
    latitude: 30.0444,
    longitude: 31.2357,
  };
  const [pin, setPin] = useState(start);
  const [moved, setMoved] = useState(false);
  const [picked, setPicked] = useState<Area | null>(null);
  // An area asked for here, by name; it replaces any picked, and picking one replaces it.
  const [asked, setAsked] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);
  // No Screen here to say where the HUD goes (a failed save shows one): it sits on the card.
  useHudAnchor(cardHeight);
  const country = venue.marketplace.code;
  const draft = venue.status === "DRAFT";

  // Once the pin has moved and nothing was picked or asked for, the nearest area is the suggestion.
  const nearest = useQuery({
    ...areas.nearest(country, pin),
    enabled: moved && !picked && !asked,
  });
  const current = venue.location;
  const area: { id: string; name: string; within: string } | null = asked
    ? null
    : picked
      ? { id: picked.id, name: picked.name, within: picked.within ?? "" }
      : moved
        ? nearest.data
          ? { id: nearest.data.id, name: nearest.data.name, within: nearest.data.within ?? "" }
          : null
        : current.id && current.name
          ? { id: current.id, name: current.name, within: current.within ?? "" }
          : null;
  // Still waiting on an area the owner asked for, and nothing chosen in its place.
  const requested =
    asked ?? (!area && !moved && current.requestedArea ? current.requestedArea : null);
  const label = area ?? (requested ? { name: requested, within: t("screens.createVenue.place.requestedNote") } : null); // prettier-ignore

  // Unmoved, the pin only changes if a different area was picked or asked for.
  const changed =
    moved ||
    (asked !== null && asked !== current.requestedArea) ||
    (area !== null && area.id !== current.id);

  const ask = (name: string) => {
    setAsked(name);
    setPicked(null);
  };

  const submit = () => {
    if (!area && !asked) return;
    void save([
      () =>
        send(
          api.PATCH("/v1/staff/venues/{venueId}", {
            params: { path: { venueId } },
            body: {
              location: {
                coordinates: pin,
                // Google's place for the old pin doesn't describe a new one.
                placeId: moved ? null : current.placeId,
                ...(asked ? { requestedArea: asked } : { locationId: area?.id }),
              },
            },
          }),
        ),
    ]);
  };

  return (
    <View className="flex-1 bg-white" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <StatusBar style="dark" />
      <MapView
        ref={map}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...start, ...CLOSE }}
        mapPadding={{ top: 0, right: 0, bottom: cardHeight, left: 0 }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onRegionChangeComplete={(region, details) => {
          // The map settling on its first region (or the card resizing it) isn't the owner moving it.
          if (details?.isGesture === false) return;
          setPin({ latitude: region.latitude, longitude: region.longitude });
          setMoved(true);
        }}
      />
      <PinOverlay bottom={cardHeight} top={insets.top} visible hint={null} />

      <View className="absolute inset-x-5 flex-row" style={{ top: insets.top + 8 }}>
        <FloatingButton label={t("components.shared.nav.close")} onPress={() => router.back()}>
          <IconX size={20} color={colors.ink} strokeWidth={2} />
        </FloatingButton>
      </View>

      <View
        className="absolute inset-x-0 bottom-0 rounded-t-sheet bg-white px-5 pt-10"
        style={{ paddingBottom: insets.bottom + 26, ...cardShadow }}
        onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
      >
        <Text
          accessibilityRole="header"
          className="px-1 text-title font-semibold tracking-[-0.4px]"
        >
          {t("screens.setup.items.LOCATION.title")}
        </Text>
        <Text className="mb-5 mt-1.5 px-1 text-subtitle text-ink-2">
          {t("screens.setup.location.body")}
        </Text>
        <AreaCard
          label={label}
          loading={moved && !picked && !asked && nearest.isPending}
          change={t("screens.setup.location.changeArea")}
          onChange={() => setChoosing(true)}
        />
        {draft ? (
          <CardLink
            label={t(
              asked
                ? "screens.createVenue.place.changeRequest"
                : "screens.createVenue.place.requestCoverage",
            )}
            onPress={() => setRequesting(true)}
            paired
          />
        ) : null}
        <Button
          label={t("common.actions.save")}
          disabled={!changed || (!area && !asked)}
          loading={saving}
          onPress={submit}
        />
      </View>

      <AreaPicker
        visible={choosing}
        country={country}
        near={pin}
        selectedId={area?.id ?? null}
        requested={asked}
        allowRequest={draft}
        onClose={() => setChoosing(false)}
        onPick={(chosen) => {
          setPicked(chosen);
          setAsked(null);
          setChoosing(false);
        }}
        onRequest={(name) => {
          ask(name);
          setChoosing(false);
        }}
      />
      <RequestAreaSheet
        visible={requesting}
        requested={asked}
        onClose={() => setRequesting(false)}
        onRequest={(name) => {
          ask(name);
          setRequesting(false);
        }}
      />
    </View>
  );
}
