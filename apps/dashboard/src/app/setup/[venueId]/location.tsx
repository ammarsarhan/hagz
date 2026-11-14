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
import { IconX } from "@/components/icons";
import { SetupLoading } from "@/components/setup-loading";
import { Text } from "@/components/text";
import { AreaCard, cardShadow, FloatingButton, PinOverlay } from "@/components/venue-map";
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
// An area can only be requested when the venue is added: here the API takes supported areas only
// (UpdateVenue), so the picker offers no request, and a venue still waiting on its requested area
// keeps it until an area is chosen.
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
  const [choosing, setChoosing] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);
  const country = venue.marketplace.code;

  // Once the pin has moved and nothing was picked, the nearest area is the suggestion.
  const nearest = useQuery({
    ...areas.nearest(country, pin),
    enabled: moved && !picked,
  });
  const current = venue.location;
  const area: { id: string; name: string; within: string } | null = picked
    ? { id: picked.id, name: picked.name, within: picked.within ?? "" }
    : moved
      ? nearest.data
        ? { id: nearest.data.id, name: nearest.data.name, within: nearest.data.within ?? "" }
        : null
      : current.id && current.name
        ? { id: current.id, name: current.name, within: current.within ?? "" }
        : null;
  // Still waiting on an area the owner asked for, and nothing chosen in its place.
  const requested = !area && !moved && current.requestedArea ? current.requestedArea : null;
  const label = area ?? (requested ? { name: requested, within: t("screens.createVenue.place.requestedNote") } : null); // prettier-ignore

  const submit = () => {
    const sameArea = area?.id === current.id;
    if (!moved && (sameArea || !area)) return router.back();
    if (!area) return;
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
                locationId: area.id,
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
          loading={moved && !picked && nearest.isPending}
          change={t("screens.setup.location.changeArea")}
          onChange={() => setChoosing(true)}
        />
        <Button
          label={t("common.actions.save")}
          disabled={moved && !area}
          loading={saving}
          onPress={submit}
        />
      </View>

      <AreaPicker
        visible={choosing}
        country={country}
        near={pin}
        selectedId={area?.id ?? null}
        requested={null}
        allowRequest={false}
        onClose={() => setChoosing(false)}
        onPick={(chosen) => {
          setPicked(chosen);
          setChoosing(false);
        }}
      />
    </View>
  );
}
