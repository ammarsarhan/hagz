import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, TextInput, View, useWindowDimensions } from "react-native";
import { choosableAreas, type Location } from "@/lib/areas";
import { colors } from "@/lib/colors";
import { FieldBox, inputClass } from "./field";
import { IconCircleCheckFilled, IconSearch } from "./icons";
import { Sheet } from "./sheet";
import { Text } from "./text";

// When the area matched from the pin is wrong, or there was no match: every area the marketplace
// has, filtered as you type. Areas are seeded by admins, so this is the whole list — a few hundred
// rows at most, which a filtered list handles without paging.
//
// Only the leaves are offered: a venue belongs to a neighbourhood, not to a governorate, and the
// parent is shown beside each name so two "Nasr City" rows can be told apart.
export function AreaPicker({
  visible,
  locations,
  selected,
  onClose,
  onPick,
}: {
  visible: boolean;
  locations: Location[];
  selected: Location | null;
  onClose: () => void;
  onPick: (location: Location) => void;
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

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={t("components.shared.nav.close")}>
      <Text accessibilityRole="header" className="mb-4 mt-1 text-heading font-semibold">
        {t("screens.createVenue.place.chooseArea")}
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
            <Text className="pt-7 text-body text-ink-2">
              {t("screens.createVenue.place.noAreas")}
            </Text>
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
