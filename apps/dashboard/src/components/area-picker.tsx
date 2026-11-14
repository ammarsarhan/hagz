import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, TextInput, View, useWindowDimensions } from "react-native";
import { choosableAreas, type Location } from "@/lib/areas";
import { colors } from "@/lib/colors";
import { FieldBox, inputClass } from "./field";
import { IconCircleCheckFilled, IconPlus, IconSearch } from "./icons";
import { Sheet } from "./sheet";
import { Text } from "./text";

// When the area matched from the pin is wrong, or there was no match: every area the marketplace
// has, filtered as you type. Areas are seeded by admins, so this is the whole list — a few hundred
// rows at most, which a filtered list handles without paging.
//
// Only the leaves are offered: a venue belongs to a neighbourhood, not to a governorate, and the
// parent is shown beside each name so two "Nasr City" rows can be told apart.
//
// An area that isn't listed can still be asked for: whatever's typed becomes a request, which Hagz
// adds while reviewing the venue (docs/onboarding.md, "Areas Hagz doesn't cover yet").
export function AreaPicker({
  visible,
  locations,
  selected,
  requested,
  onClose,
  onPick,
  onRequest,
}: {
  visible: boolean;
  locations: Location[];
  selected: Location | null;
  requested: string | null;
  onClose: () => void;
  onPick: (location: Location) => void;
  onRequest: (name: string) => void;
}) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const areas = useMemo(() => choosableAreas(locations), [locations]);
  const typed = query.trim().toLocaleLowerCase();
  const shown = typed
    ? areas.filter(
        (area) =>
          area.name.toLocaleLowerCase().includes(typed) ||
          area.within.toLocaleLowerCase().includes(typed),
      )
    : areas;
  // Offered for anything typed that isn't exactly one of ours: "Maadi" is in the list, so it's
  // picked, not asked for.
  const request = query.trim().replace(/\s+/g, " ");
  const canRequest =
    request.length >= 2 && !areas.some((area) => area.name.toLocaleLowerCase() === typed);

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={t("components.shared.nav.close")}>
      <Text accessibilityRole="header" className="mt-1 text-heading font-semibold">
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
          placeholder={t("screens.createVenue.place.areaSearchPlaceholder")}
          placeholderTextColor={colors.ink3}
          selectionColor={colors.primary}
          autoCorrect={false}
        />
      </FieldBox>
      {/* Tall enough to show several areas, short enough to leave the map behind it in view. */}
      <View style={{ height: Math.min(360, height * 0.45) }}>
        <FlatList
          data={shown}
          keyExtractor={(area) => area.location.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            canRequest ? undefined : (
              <Text className="pt-7 text-body text-ink-2">
                {t("screens.createVenue.place.noAreas")}
              </Text>
            )
          }
          ListFooterComponent={
            canRequest ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: requested === request }}
                onPress={() => onRequest(request)}
                className="flex-row items-center gap-3 py-3.5 active:opacity-60"
              >
                <View className="size-9 items-center justify-center rounded-full bg-blue-tint">
                  <IconPlus size={18} color={colors.primary} strokeWidth={2} />
                </View>
                <View className="flex-1">
                  <Text className="text-subtitle font-medium leading-[1.31]" numberOfLines={2}>
                    {t("screens.createVenue.place.requestArea", { area: request })}
                  </Text>
                  <Text className="mt-[3px] text-label leading-[1.43] text-ink-2">
                    {t("screens.createVenue.place.requestAreaNote")}
                  </Text>
                </View>
              </Pressable>
            ) : undefined
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: item.location.id === selected?.id }}
              onPress={() => onPick(item.location)}
              className="flex-row items-center gap-3 border-b border-border py-3.5 active:opacity-60"
            >
              <View className="flex-1">
                <Text className="text-subtitle font-medium leading-[1.31]">{item.name}</Text>
                {item.within ? (
                  <Text className="mt-[3px] text-label leading-[1.43] text-ink-2">
                    {item.within}
                  </Text>
                ) : null}
              </View>
              {item.location.id === selected?.id ? (
                <IconCircleCheckFilled size={20} color={colors.primary} />
              ) : null}
            </Pressable>
          )}
        />
      </View>
    </Sheet>
  );
}
