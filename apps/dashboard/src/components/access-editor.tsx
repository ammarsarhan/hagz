import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AREAS, LEVELS, type Area, type Level, type Permissions } from "@/lib/team";
import { Segmented } from "./choices";
import { Text } from "./text";

// The seven areas (Figma D20 726:109), each with what it covers in grey and None / View / Manage
// beside it. `onChange` is left out to show access read-only (your own, or the owner's).
export function AccessEditor({
  permissions,
  onChange,
}: {
  permissions: Permissions;
  onChange?: (area: Area, level: Level) => void;
}) {
  const { t } = useTranslation();
  return (
    <View>
      {AREAS.map((area, index) => (
        <View
          key={area}
          className={`flex-row items-center gap-3 py-3 ${index < AREAS.length - 1 ? "border-b border-border" : ""}`}
        >
          <View className="flex-1">
            <Text className="text-[15px] font-medium leading-[1.33]">
              {t(`screens.team.areas.${area}`)}
            </Text>
            <Text className="mt-0.5 text-caption text-ink-2" numberOfLines={1}>
              {t(`screens.team.areaBodies.${area}`)}
            </Text>
          </View>
          {onChange ? (
            <View className="w-[204px]">
              <Segmented
                options={LEVELS}
                value={permissions[area]}
                label={(level) => t(`screens.team.levels.${level}`)}
                onChange={(level) => onChange(area, level)}
              />
            </View>
          ) : (
            <Text
              className={`text-body ${permissions[area] === "none" ? "text-ink-3" : "font-medium"}`}
            >
              {t(`screens.team.levels.${permissions[area]}`)}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
