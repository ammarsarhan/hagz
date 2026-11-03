import type { components } from "@hagz/api";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Text } from "./text";

type Permissions = components["schemas"]["StaffPermissions"];

const AREAS = [
  "bookings",
  "customers",
  "schedule",
  "payments",
  "finance",
  "staff",
  "venue",
] as const;
const LEVEL_STYLE = {
  manage: "font-medium text-ink",
  view: "font-medium text-ink-2",
  none: "text-ink-3",
} as const;

// What an invitation would let someone do, area by area, so nobody accepts access they can't see.
export function AccessList({ permissions }: { permissions: Permissions }) {
  const { t } = useTranslation();
  return (
    <View className="border-t border-border">
      {AREAS.map((area) => (
        <View
          key={area}
          className="flex-row items-center justify-between border-b border-border py-3"
        >
          <Text className="text-body">{t(`screens.invitation.areas.${area}`)}</Text>
          <Text className={`text-body ${LEVEL_STYLE[permissions[area]]}`}>
            {t(`screens.invitation.levels.${permissions[area]}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}
