import type { Icon } from "@tabler/icons-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { SIZES_BY_SPORT } from "@hagz/contracts";
import { Button } from "@/components/button";
import { ChoicePill, ChoicePills } from "@/components/choices";
import { Field } from "@/components/field";
import {
  IconBallBasketball,
  IconBallFootball,
  IconBallTennis,
  IconBallVolleyball,
} from "@/components/icons";
import { SectionHeading, StepScreen } from "@/components/step-screen";
import { Text } from "@/components/text";
import { colors } from "@/lib/colors";
import { useGroundFlow } from "@/lib/ground-flow";
import { SPORTS, type GroundSport } from "@/lib/grounds";

// Adding a ground, 1 of 4 (Figma "Grounds · Add 1 Name, sport and size", 352:2). The sport and size
// fix its footprint on the layout, so they come first. Only football comes in sizes; the others
// are one standard court, and the size row goes away for them.
const ICONS: Record<GroundSport, Icon> = {
  FOOTBALL: IconBallFootball,
  // Tabler has no padel ball; a padel ball is a tennis ball.
  PADEL: IconBallTennis,
  TENNIS: IconBallTennis,
  BASKETBALL: IconBallBasketball,
  VOLLEYBALL: IconBallVolleyball,
};
const COLUMNS = 3;

export default function GroundBasics() {
  const { t } = useTranslation();
  const { venueId = "", groundId = "new" } = useLocalSearchParams<{
    venueId: string;
    groundId: string;
  }>();
  const { ground, draft, update, remove, saving } = useGroundFlow();
  const sizes = SIZES_BY_SPORT[draft.sport].filter((size) => size !== "STANDARD");
  const rows = Array.from({ length: Math.ceil(SPORTS.length / COLUMNS) }, (_, row) =>
    SPORTS.slice(row * COLUMNS, row * COLUMNS + COLUMNS),
  );

  return (
    <StepScreen
      title={t(ground ? "screens.setup.grounds.editTitle" : "screens.setup.grounds.addTitle")}
      subtitle={t("screens.setup.grounds.addSubtitle")}
      footer={
        <View className="gap-1">
          <Button
            label={t("common.actions.continue")}
            disabled={draft.name.trim() === ""}
            onPress={() => router.push(`/setup/${venueId}/grounds/${groundId}/surface`)}
          />
          {ground ? (
            <Button
              label={t("screens.setup.grounds.remove")}
              variant="ghost"
              loading={saving}
              onPress={remove}
            />
          ) : null}
        </View>
      }
    >
      <Field
        label={t("screens.setup.grounds.name")}
        value={draft.name}
        onChangeText={(name) => update({ name })}
        maxLength={40}
        autoCapitalize="words"
        returnKeyType="done"
      />

      <SectionHeading afterField>{t("screens.setup.grounds.sport")}</SectionHeading>
      <View accessibilityRole="radiogroup" className="gap-2.5">
        {rows.map((row) => (
          <View key={row.join()} className="flex-row gap-2.5">
            {row.map((sport) => (
              <SportTile
                key={sport}
                sport={sport}
                selected={draft.sport === sport}
                onPress={() =>
                  // A new sport starts at its first size: 5-a-side, or the one standard court.
                  update({ sport, size: SIZES_BY_SPORT[sport][0] })
                }
              />
            ))}
            {/* Keeps the last row's tiles the width of the others. */}
            {Array.from({ length: COLUMNS - row.length }, (_, i) => (
              <View key={i} className="flex-1" />
            ))}
          </View>
        ))}
      </View>

      {sizes.length > 0 ? (
        <>
          <SectionHeading>{t("screens.setup.grounds.size")}</SectionHeading>
          <ChoicePills>
            {sizes.map((size) => (
              <ChoicePill
                key={size}
                label={t(`screens.setup.grounds.sizes.${size}`)}
                selected={draft.size === size}
                onPress={() => update({ size })}
              />
            ))}
          </ChoicePills>
        </>
      ) : null}
    </StepScreen>
  );
}

// A sport: its ball over its name, in a tile three to a row. Chosen = blue outline on a blue tint.
function SportTile({
  sport,
  selected,
  onPress,
}: {
  sport: GroundSport;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const Ball = ICONS[sport];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`h-[84px] flex-1 justify-between rounded-[16px] border p-3.5 active:opacity-70 ${selected ? "border-primary bg-blue-tint" : "border-border bg-white"}`}
    >
      <Ball size={24} color={selected ? colors.primary : colors.ink} />
      <Text className="text-body font-medium" numberOfLines={1}>
        {t(`screens.setup.grounds.sports.${sport}`)}
      </Text>
    </Pressable>
  );
}
