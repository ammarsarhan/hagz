import type { components } from "@hagz/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
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

export type Area = components["schemas"]["Area"];

// Choosing the area a venue is filed under (Figma "Area picker · 2 Typing, with matches", 427:192).
// It's the "Find your venue" sheet again: it covers the map, so the keyboard leaves the results
// room, and the whole list scrolls as one.
//
// Before anything's typed it lists the areas nearest the pin, with how far each is; typing searches
// every area by name, in Arabic or English, nearest first. The API does both (only the page shown is
// fetched, never the whole tree). Anything typed can also be asked for: an area Hagz doesn't cover
// yet, which it adds when the venue is submitted (docs/onboarding.md).
const DEBOUNCE_MS = 250;
const MIN_REQUEST = 2;

export function AreaPicker({
  visible,
  country,
  near,
  selected,
  requested,
  onClose,
  onPick,
  onRequest,
}: {
  visible: boolean;
  // The pin's country, whose areas these are.
  country: string;
  // The pin: results nearest it come first.
  near: Coordinates;
  selected: Area | null;
  requested: string | null;
  onClose: () => void;
  onPick: (area: Area) => void;
  onRequest: (name: string) => void;
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
  const found = results.data ?? [];
  const canRequest =
    typed.length >= MIN_REQUEST &&
    !found.some((area) => area.name.toLocaleLowerCase() === typed.toLocaleLowerCase());

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
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
            {t("screens.createVenue.place.chooseAreaBody")}
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
            contentContainerStyle={{ paddingTop: 10, paddingBottom: insets.bottom + 24 }}
            ListHeaderComponent={
              typed ? undefined : (
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
              ) : typed ? (
                <Text className="pt-4 text-body text-ink-2">
                  {t("screens.createVenue.place.noAreaCalled", { query: typed })}
                </Text>
              ) : undefined
            }
            ListFooterComponent={
              canRequest ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: requested === typed }}
                  onPress={() => {
                    Keyboard.dismiss();
                    onRequest(typed);
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
              ) : undefined
            }
            renderItem={({ item }) => (
              <AreaRow
                area={item}
                selected={item.id === selected?.id}
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
