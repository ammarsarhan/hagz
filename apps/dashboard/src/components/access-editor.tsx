import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { AREAS, LEVELS, type Area, type Level, type Permissions } from "@/lib/team";
import { Segmented } from "./choices";
import { SettingsHeading } from "./settings-row";
import { Sheet } from "./sheet";
import { Text } from "./text";

// Grouped by what they can do (Figma D20b 730:218, picked 2026-11-27): Can change, Can see, Hidden,
// each a few chips of areas. Tapping one opens a sheet with None / View / Manage; the pick moves
// the chip to its group and the sheet closes. Empty groups are left out. Without `onChange` it's
// read-only (your own access, or the owner's).
const GROUPS: { level: Level; key: "manage" | "view" | "none" }[] = [
  { level: "manage", key: "manage" },
  { level: "view", key: "view" },
  { level: "none", key: "none" },
];

export function AccessEditor({
  permissions,
  onChange,
  first = false,
  hint,
}: {
  permissions: Permissions;
  onChange?: (area: Area, level: Level) => void;
  // Right under the title, the first heading a little closer.
  first?: boolean;
  // Under the chips, in place of "Tap an area to change it".
  hint?: string;
}) {
  const { t } = useTranslation();
  // The area being changed, kept until the sheet has gone so its words don't vanish mid-slide.
  const [area, setArea] = useState<Area | null>(null);
  const [open, setOpen] = useState(false);
  const shown = GROUPS.filter(({ level }) => AREAS.some((one) => permissions[one] === level));

  return (
    <View>
      {shown.map(({ level, key }, index) => (
        <View key={key}>
          <SettingsHeading tight={first && index === 0} first={!first && index === 0}>
            {t(`screens.team.groups.${key}`)}
          </SettingsHeading>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {AREAS.filter((one) => permissions[one] === level).map((one) => (
              <Pressable
                key={one}
                accessibilityRole={onChange ? "button" : undefined}
                accessibilityLabel={`${t(`screens.team.areas.${one}`)}, ${t(`screens.team.levels.${level}`)}`}
                disabled={!onChange}
                onPress={() => {
                  setArea(one);
                  setOpen(true);
                }}
                className="rounded-full bg-chip px-3.5 py-2 active:opacity-60"
              >
                <Text
                  className={`text-[14px] font-medium leading-[18px] ${level === "none" ? "text-ink-3" : ""}`}
                >
                  {t(`screens.team.areas.${one}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      {onChange ? (
        <Text className="mt-5 text-caption text-ink-2">{hint ?? t("screens.team.tapArea")}</Text>
      ) : null}

      {area && onChange ? (
        <Sheet
          visible={open}
          onClose={() => setOpen(false)}
          onHidden={() => setArea(null)}
          closeLabel={t("components.shared.nav.close")}
        >
          <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
            {t(`screens.team.areas.${area}`)}
          </Text>
          <Text className="mt-1 mb-5 text-body text-ink-2">
            {t(`screens.team.areaBodies.${area}`)}
          </Text>
          <Segmented
            options={LEVELS}
            value={permissions[area]}
            label={(level) => t(`screens.team.levels.${level}`)}
            onChange={(level) => {
              onChange(area, level);
              setOpen(false);
            }}
          />
          <Text className="mt-3 text-caption text-ink-2">
            {t(`screens.team.levelBodies.${permissions[area]}`)}
          </Text>
        </Sheet>
      ) : null}
    </View>
  );
}
