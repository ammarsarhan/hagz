import type { components } from "@hagz/api";
import { PIN_NEAR_AREA_METRES } from "@hagz/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import type { Coordinates } from "@/lib/places";
import { areas } from "@/lib/queries";
import { FieldBox, inputClass } from "./field";
import { SheetHud } from "./hud";
import { IconCircleCheckFilled, IconSearch } from "./icons";
import { CloseButton } from "./nav";
import { Text } from "./text";
import { CardLink } from "./venue-map";

export type Area = components["schemas"]["Area"];

// Choosing the area a venue is filed under (Figma "Area picker · 2 Typing, with matches", 427:192).
// It's the "Find your venue" sheet again: it covers the map, so the keyboard leaves the results
// room, and the whole list scrolls as one.
//
// Before anything's typed it lists the areas nearest the pin, with how far each is; typing searches
// every area by name, in Arabic or English, nearest first. The API does both (only the page shown is
// fetched, never the whole tree). Anything typed can also be asked for: an area Hagz doesn't cover
// yet, which it adds when the venue is submitted (docs/onboarding.md), unless `allowRequest` is off.
// The list ends on Request coverage (`onRequestCoverage`), for an owner who'd rather not search
// first; the screen asks for the name in its own sheet once this one has gone (`onHidden`).
//
// Only areas the pin could be listed under are offered: the API turns away one whose centre is more
// than PIN_NEAR_AREA_METRES from the pin (PIN_FAR_FROM_AREA). An area without a centre has no
// distance to go by, so it isn't offered either. A pin with nothing in reach is out of coverage,
// and the sheet says so instead of listing areas across the country.
const DEBOUNCE_MS = 250;
const REACH_KM = PIN_NEAR_AREA_METRES / 1000;
export const withinReach = (area: Area) =>
  area.distance !== null && area.distance <= PIN_NEAR_AREA_METRES;
const MIN_REQUEST = 2;

export function AreaPicker({
  visible,
  country,
  near,
  selectedId,
  requested,
  allowRequest = true,
  onClose,
  onPick,
  onRequest,
  onRequestCoverage,
  onHidden,
}: {
  visible: boolean;
  // The pin's country, whose areas these are.
  country: string;
  // The pin: results nearest it come first.
  near: Coordinates;
  selectedId: string | null;
  requested: string | null;
  // Off where the API takes supported areas only (moving an existing venue's pin).
  allowRequest?: boolean;
  onClose: () => void;
  onPick: (area: Area) => void;
  onRequest?: (name: string) => void;
  onRequestCoverage?: () => void;
  // Once the sheet has gone: iOS won't present another modal while this one is still leaving.
  onHidden?: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  // What's searched for: the query once typing pauses, so a word is one request, not six.
  const [searched, setSearched] = useState("");

  // A fresh sheet each time it opens.
  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setSearched("");
  }, [visible]);

  // iOS says when the Modal is really gone (onDismiss below); Android presents over a leaving one.
  const wasVisible = useRef(visible);
  const hidden = useRef(onHidden);
  hidden.current = onHidden;
  useEffect(() => {
    if (wasVisible.current && !visible && Platform.OS !== "ios") hidden.current?.();
    wasVisible.current = visible;
  }, [visible]);

  useEffect(() => {
    const timer = setTimeout(() => setSearched(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useQuery({
    ...areas.search(country, searched, near),
    enabled: visible,
    // The last answer stays up while the next one loads, so the list doesn't blink per keystroke.
    placeholderData: keepPreviousData,
  });

  // Typed text, tidied, is what a request would send.
  const typed = query.trim().replace(/\s+/g, " ");
  const matches = results.data ?? [];
  const found = matches.filter(withinReach);
  const canRequest =
    allowRequest &&
    typed.length >= MIN_REQUEST &&
    !found.some((area) => area.name.toLocaleLowerCase() === typed.toLocaleLowerCase());

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={Platform.OS === "ios" ? () => hidden.current?.() : undefined}
      statusBarTranslucent
    >
      <View className="flex-1 bg-scrim" style={{ direction: isRTL ? "rtl" : "ltr" }}>
        <View
          className="flex-1 rounded-t-[24px] bg-white px-6 pt-4"
          style={{ marginTop: insets.top + 14 }}
        >
          <View className="flex-row justify-end">
            <CloseButton label={t("components.shared.nav.close")} onPress={onClose} />
          </View>
          <Text
            accessibilityRole="header"
            className="mt-1 text-[22px] font-semibold leading-[1.27] tracking-[-0.3px]"
          >
            {t("screens.createVenue.place.chooseArea")}
          </Text>
          <Text className="mb-4 mt-1.5 text-body text-ink-2">
            {t(
              allowRequest
                ? "screens.createVenue.place.chooseAreaBody"
                : "screens.createVenue.place.chooseAreaBodyListed",
            )}
          </Text>

          <FieldBox focused={focused} error={false}>
            <IconSearch size={20} color={focused || query ? colors.ink : colors.ink3} />
            <TextInput
              className={inputClass}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={t("screens.createVenue.place.areaSearchPlaceholder")}
              placeholderTextColor={colors.ink3}
              selectionColor={colors.primary}
              autoCorrect={false}
              returnKeyType="search"
            />
          </FieldBox>

          <FlatList
            className="flex-1"
            data={found}
            keyExtractor={(area) => area.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 24 }}
            ListHeaderComponent={
              typed || found.length === 0 ? undefined : (
                <Text className="pb-0.5 pt-3 text-label font-medium text-ink-2">
                  {t("screens.createVenue.place.nearYourPin")}
                </Text>
              )
            }
            ListEmptyComponent={
              results.isPending ? (
                <View className="items-center pt-8">
                  <ActivityIndicator color={colors.ink3} />
                </View>
              ) : (
                <Text className="pt-4 text-body text-ink-2">
                  {typed
                    ? matches.length > 0
                      ? t("screens.createVenue.place.areaTooFar", { query: typed, km: REACH_KM })
                      : t("screens.createVenue.place.noAreaCalled", { query: typed })
                    : t(
                        allowRequest
                          ? "screens.createVenue.place.noAreaNearRequest"
                          : "screens.createVenue.place.noAreaNear",
                        { km: REACH_KM },
                      )}
                </Text>
              )
            }
            ListFooterComponent={
              canRequest ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: requested === typed }}
                  onPress={() => {
                    Keyboard.dismiss();
                    onRequest?.(typed);
                  }}
                  hitSlop={8}
                  className="pt-[18px] active:opacity-60"
                >
                  <Text className="text-body text-ink-2">
                    {t("screens.createVenue.place.notListed")}{" "}
                    <Text className="text-body font-medium text-primary">
                      {t("screens.createVenue.place.requestArea", { area: typed })}
                    </Text>
                  </Text>
                </Pressable>
              ) : allowRequest && onRequestCoverage ? (
                <View className="pt-2">
                  <CardLink
                    label={t("screens.createVenue.place.requestCoverage")}
                    onPress={() => {
                      Keyboard.dismiss();
                      onRequestCoverage();
                    }}
                  />
                </View>
              ) : undefined
            }
            renderItem={({ item }) => (
              <AreaRow
                area={item}
                selected={item.id === selectedId}
                onPress={() => {
                  Keyboard.dismiss();
                  onPick(item);
                }}
              />
            )}
          />
        </View>
        <SheetHud open={visible} bottom={insets.bottom + 14} />
      </View>
    </Modal>
  );
}

// 1.1 km, 10 km: a decimal only while it tells nearby areas apart.
const distanceIn = (metres: number) => {
  const km = metres / 1000;
  return km < 10 ? km.toFixed(1) : String(Math.round(km));
};

function AreaRow({
  area,
  selected,
  onPress,
}: {
  area: Area;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="flex-row items-center gap-3 border-b border-border py-[13px] active:opacity-60"
    >
      <View className="flex-1">
        <Text className="text-subtitle font-medium leading-[1.25]">{area.name}</Text>
        {area.within ? (
          <Text className="text-label leading-[1.29] text-ink-2">{area.within}</Text>
        ) : null}
      </View>
      {selected ? (
        <IconCircleCheckFilled size={20} color={colors.primary} />
      ) : area.distance !== null ? (
        <Text className="text-label text-ink-3">
          {t("screens.createVenue.place.distanceKm", { km: distanceIn(area.distance) })}
        </Text>
      ) : null}
    </Pressable>
  );
}
