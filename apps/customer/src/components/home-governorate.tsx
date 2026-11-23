import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { colors } from "@/lib/colors";
import type { Governorate } from "@/lib/search";
import { IconNavigation } from "./icons";
import { Sheet } from "./sheet";
import { Text } from "./text";

// Home's where (user, 2026-11-23): a governorate, picked from pills with their venue counts, or
// "Use my location" for the one the phone is in. Narrowing further (an area, around a point) is
// Search's job, which the line under the title says.

export function HomeGovernorateSheet({
  visible,
  coverage,
  current,
  usingLocation,
  located,
  onPick,
  onClose,
}: {
  visible: boolean;
  coverage: Governorate[];
  current: string | null;
  usingLocation: boolean;
  // The phone's governorate has venues, so Use my location has somewhere to go.
  located: boolean;
  // A governorate's id, or null for the phone's own.
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text accessibilityRole="header" className="text-heading font-semibold">
        {t("screens.home.where.title")}
      </Text>
      <Text className="mt-1.5 text-body text-ink-2">{t("screens.home.where.line")}</Text>
      <View className="mt-5 flex-row flex-wrap gap-2 pb-2">
        {located ? (
          <Choice
            on={usingLocation}
            onPress={() => onPick(null)}
            label={t("screens.home.where.useLocation")}
            icon
          />
        ) : null}
        {coverage.map((governorate) => (
          <Choice
            key={governorate.id}
            on={!usingLocation && governorate.id === current}
            onPress={() => onPick(governorate.id)}
            label={governorate.name ?? ""}
            count={governorate.venues}
          />
        ))}
      </View>
    </Sheet>
  );
}

function Choice({
  label,
  count,
  on,
  icon = false,
  onPress,
}: {
  label: string;
  count?: number;
  on: boolean;
  icon?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityHint={count === undefined ? undefined : t("formats.venues", { count })}
      onPress={onPress}
      className={`h-10 flex-row items-center gap-1.5 rounded-full px-4 active:opacity-70 ${on ? "bg-ink" : "border border-border bg-white"}`}
    >
      {icon ? (
        <IconNavigation size={15} color={on ? colors.white : colors.ink} strokeWidth={2} />
      ) : null}
      <Text className={`text-body font-medium ${on ? "text-white" : "text-ink"}`}>{label}</Text>
      {count === undefined ? null : (
        <Text className={`text-caption ${on ? "text-white/60" : "text-unit"}`}>{count}</Text>
      )}
    </Pressable>
  );
}
