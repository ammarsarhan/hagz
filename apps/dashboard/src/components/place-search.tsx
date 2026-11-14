import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
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
import {
  addressAt,
  placeDetails,
  placesConfigured,
  searchPlaces,
  type Coordinates,
  type Place,
  type Suggestion,
} from "@/lib/places";
import { FieldBox, inputClass } from "./field";
import { SheetHud, useHud } from "./hud";
import { IconCurrentLocation, IconMapPin, IconSearch, IconX } from "./icons";
import { CloseButton } from "./nav";
import { Text } from "./text";

// Finding a venue by name or street (Figma "Venue creation · 4 Search sheet", 280:38): Google's
// suggestions as the owner types, their current location, or dropping a pin by hand for the many
// Cairo pitches Google has never heard of.
//
// It covers the map rather than sliding up from it, because the keyboard would leave a bottom sheet
// nowhere to put the results. Typing is held back a moment so a word costs one search, not six,
// and every keystroke of a search shares one session token, which is how Google bills it.
const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

const newSessionToken = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function PlaceSearch({
  visible,
  near,
  onClose,
  onPick,
  onDropPin,
}: {
  visible: boolean;
  // Where the map is looking, so results near it come first.
  near?: Coordinates;
  onClose: () => void;
  onPick: (place: Place) => void;
  onDropPin: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const hud = useHud();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  // The place being fetched (a tapped suggestion, or the phone's own position), so the row shows it
  // is working and a second tap can't start another.
  const [picking, setPicking] = useState<string | null>(null);
  const session = useRef(newSessionToken());

  // A fresh sheet each time: nothing of the last search left on screen, and a new billing session.
  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setSuggestions([]);
    setPicking(null);
    session.current = newSessionToken();
  }, [visible]);

  useEffect(() => {
    const typed = query.trim();
    if (typed.length < MIN_QUERY) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    if (!placesConfigured) return;
    setSearching(true);
    let dropped = false;
    const timer = setTimeout(() => {
      searchPlaces(typed, { sessionToken: session.current, near })
        .then((found) => {
          if (!dropped) setSuggestions(found);
        })
        .catch((error: unknown) => {
          if (dropped) return;
          console.warn(error);
          setSuggestions([]);
          hud.show(t("screens.createVenue.place.searchFailed"));
        })
        .finally(() => {
          if (!dropped) setSearching(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      dropped = true;
      clearTimeout(timer);
    };
  }, [query, near, hud, t]);

  const pick = async (suggestion: Suggestion) => {
    setPicking(suggestion.placeId);
    try {
      const place = await placeDetails(suggestion.placeId, session.current);
      Keyboard.dismiss();
      onPick({ ...place, name: place.name ?? suggestion.name });
    } catch (error) {
      console.warn(error);
      hud.show(t("screens.createVenue.place.searchFailed"));
    } finally {
      setPicking(null);
    }
  };

  // The phone's own position, which is where most owners are standing when they sign up.
  const useMyLocation = async () => {
    setPicking("me");
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        hud.show(t("screens.createVenue.place.locationDenied"));
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      // The address is a nicety here; the pin is what matters, so a failed lookup still moves on.
      const place = await addressAt(coordinates).catch((error: unknown) => {
        console.warn(error);
        return { address: "", coordinates, parts: [] } satisfies Place;
      });
      Keyboard.dismiss();
      onPick(place);
    } catch (error) {
      console.warn(error);
      hud.show(t("screens.createVenue.place.locationFailed"));
    } finally {
      setPicking(null);
    }
  };

  const typed = query.trim().length >= MIN_QUERY;

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
            {t("screens.createVenue.place.searchTitle")}
          </Text>
          <Text className="mb-4 mt-1.5 text-body text-ink-2">
            {t("screens.createVenue.place.searchBody")}
          </Text>

          <FieldBox focused={focused} error={false}>
            <IconSearch size={20} color={focused || query ? colors.ink : colors.ink3} />
            <TextInput
              className={inputClass}
              value={query}
              onChangeText={setQuery}
              placeholder={t("screens.createVenue.place.searchPlaceholder")}
              placeholderTextColor={colors.ink3}
              selectionColor={colors.primary}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("screens.createVenue.place.clear")}
                onPress={() => setQuery("")}
                hitSlop={10}
                className="active:opacity-60"
              >
                <IconX size={18} color={colors.ink3} />
              </Pressable>
            ) : null}
          </FieldBox>

          <Pressable
            accessibilityRole="button"
            onPress={() => void useMyLocation()}
            disabled={picking !== null}
            className="flex-row items-center gap-2.5 border-b border-border py-[15px] active:opacity-60"
          >
            {picking === "me" ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <IconCurrentLocation size={18} color={colors.primary} />
            )}
            <Text className="text-body font-medium text-primary">
              {t("screens.createVenue.place.useMyLocation")}
            </Text>
          </Pressable>

          <FlatList
            data={suggestions}
            keyExtractor={(suggestion) => suggestion.placeId}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Empty
                configured={placesConfigured}
                searching={searching}
                typed={typed}
                query={query}
              />
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => void pick(item)}
                disabled={picking !== null}
                className="flex-row items-center gap-3.5 border-b border-border py-3.5 active:opacity-60"
              >
                <View className="size-10 items-center justify-center rounded-full bg-chip">
                  {picking === item.placeId ? (
                    <ActivityIndicator size="small" color={colors.ink3} />
                  ) : (
                    <IconMapPin size={20} color={colors.ink} />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-subtitle font-medium leading-[1.25]">{item.name}</Text>
                  {item.address ? (
                    <Text className="text-label leading-[1.29] text-ink-2">{item.address}</Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />

          <View style={{ paddingBottom: insets.bottom + 14 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                Keyboard.dismiss();
                onDropPin();
              }}
              hitSlop={8}
              className="pt-[18px] active:opacity-60"
            >
              <Text className="text-body text-ink-2">
                {t("screens.createVenue.place.cantFind")}{" "}
                <Text className="text-body font-medium text-primary">
                  {t("screens.createVenue.place.dropPin")}
                </Text>
              </Text>
            </Pressable>
          </View>
        </View>
        <SheetHud open={visible} bottom={insets.bottom + 14} />
      </View>
    </Modal>
  );
}

// What fills the list before there's anything in it: nothing at all while they haven't typed
// enough, the spinner while Google answers, and a line when it has nothing or can't be asked.
function Empty({
  configured,
  searching,
  typed,
  query,
}: {
  configured: boolean;
  searching: boolean;
  typed: boolean;
  query: string;
}) {
  const { t } = useTranslation();
  if (!configured) {
    return <Note>{t("screens.createVenue.place.searchUnavailable")}</Note>;
  }
  if (searching) {
    return (
      <View className="items-center pt-8">
        <ActivityIndicator color={colors.ink3} />
      </View>
    );
  }
  if (!typed) return null;
  return <Note>{t("screens.createVenue.place.noResults", { query: query.trim() })}</Note>;
}

function Note({ children }: { children: string }) {
  return <Text className="pt-7 text-body text-ink-2">{children}</Text>;
}
