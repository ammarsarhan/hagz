import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { GroupHeading } from "./group-heading";
import { Sheet } from "./sheet";
import { Text } from "./text";

// Everything on the venue layout as a list, from the layout's list button (not drawn in Figma; the
// app's usual sheet): grounds, then amenities, then entrances. Picking one closes the sheet, and the
// layout glides to it and selects it, which is quicker than hunting for it on a big venue.

export interface ListedItem {
  key: string;
  icon: ReactNode;
  name: string;
  // What it is or where: "5-a-side", "2 × 2", "Bottom edge".
  detail: string;
}

export function LayoutList({
  visible,
  groups,
  onClose,
  onPick,
}: {
  visible: boolean;
  groups: { title: string; items: ListedItem[] }[];
  onClose: () => void;
  onPick: (key: string) => void;
}) {
  const { t } = useTranslation();
  const screen = useWindowDimensions();
  const shown = groups.filter((group) => group.items.length > 0);
  return (
    <Sheet visible={visible} onClose={onClose} closeLabel={t("components.shared.nav.close")}>
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t("screens.setup.layout.listTitle")}
      </Text>
      {shown.length === 0 ? (
        <Text className="mb-2 mt-1.5 text-body text-ink-2">
          {t("screens.setup.layout.listEmpty")}
        </Text>
      ) : (
        <ScrollView style={{ maxHeight: screen.height * 0.55 }}>
          {shown.map((group) => (
            <View key={group.title}>
              <GroupHeading className="mb-1 mt-5">{group.title}</GroupHeading>
              {group.items.map((item, index) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  onPress={() => onPick(item.key)}
                  className={`flex-row items-center gap-3.5 py-3.5 active:opacity-60 ${
                    index === group.items.length - 1 ? "" : "border-b border-border"
                  }`}
                >
                  <View className="w-11 items-center">{item.icon}</View>
                  <Text className="flex-1 text-subtitle font-medium" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-label text-ink-2">{item.detail}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
}
