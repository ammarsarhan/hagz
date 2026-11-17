import type { Icon } from "@tabler/icons-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { SIZES_BY_SPORT, SURFACES_BY_SPORT, surfaceFitsSport } from "@hagz/contracts";
import { Button } from "@/components/button";
import {
  ChoicePill,
  ChoicePills,
  CrossFade,
  SelectionBox,
  useSelection,
} from "@/components/choices";
import { Field } from "@/components/field";
import { SPORT_ICONS } from "@/components/sport-icons";
import { SectionHeading, StepScreen } from "@/components/step-screen";
import { Text } from "@/components/text";
import { colors } from "@/lib/colors";
import { useGroundFlow } from "@/lib/ground-flow";
import { SPORTS, type GroundSport } from "@/lib/grounds";

// Adding a ground, 1 of 4 (Figma "Grounds · Add 1 Name, sport and size", 352:2). The sport and size
// fix its footprint on the layout, so they come first. Only football comes in sizes; the others
// are one standard court, and the size row goes away for them.
const COLUMNS = 3;

export default function GroundBasics() {
  const { t } = useTranslation();
  const { venueId = "", groundId = "new" } = useLocalSearchParams<{
    venueId: string;
    groundId: string;
  }>();
  const { ground, draft, update } = useGroundFlow();
  const sizes = SIZES_BY_SPORT[draft.sport].filter((size) => size !== "STANDARD");
  const rows = Array.from({ length: Math.ceil(SPORTS.length / COLUMNS) }, (_, row) =>
    SPORTS.slice(row * COLUMNS, row * COLUMNS + COLUMNS),
  );

  return (
    <StepScreen
      title={t(ground ? "screens.setup.grounds.editTitle" : "screens.setup.grounds.addTitle")}
      subtitle={t("screens.setup.grounds.addSubtitle")}
      footer={
        <Button
          label={t("common.actions.continue")}
          disabled={draft.name.trim() === ""}
          onPress={() => router.push(`/setup/${venueId}/grounds/${groundId}/surface`)}
        />
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

      <SectionHeading afterField description={t("screens.setup.grounds.sportBody")}>
        {t("screens.setup.grounds.sport")}
      </SectionHeading>
      <View accessibilityRole="radiogroup" className="gap-2.5">
        {rows.map((row) => (
          <View key={row.join()} className="flex-row gap-2.5">
            {row.map((sport) => (
              <SportTile
                key={sport}
                sport={sport}
                selected={draft.sport === sport}
                onPress={() =>
                  // A new sport starts at its first size (5-a-side, or the one standard court), and
                  // keeps its surface only if the sport is played on it.
                  update({
                    sport,
                    size: SIZES_BY_SPORT[sport][0],
                    surface: surfaceFitsSport(sport, draft.surface)
                      ? draft.surface
                      : SURFACES_BY_SPORT[sport][0],
                  })
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
          <SectionHeading description={t("screens.setup.grounds.sizeBody")}>
            {t("screens.setup.grounds.size")}
          </SectionHeading>
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

// A sport: its ball over its name, in a tile three to a row. Chosen = blue outline on a blue tint,
// with the ball and the name turning blue too, all eased in together.
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
  const progress = useSelection(selected);
  const Ball = SPORT_ICONS[sport];
  const name = t(`screens.setup.grounds.sports.${sport}`);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={name}
      onPress={onPress}
      className="h-[84px] flex-1 justify-between p-3.5 active:opacity-70"
    >
      <SelectionBox progress={progress} radius={16} />
      <View className="items-start">
        <CrossFade
          progress={progress}
          off={<Ball size={24} color={colors.ink} />}
          on={<Ball size={24} color={colors.primary} />}
        />
      </View>
      <CrossFade
        progress={progress}
        off={
          <Text className="text-body font-medium" numberOfLines={1}>
            {name}
          </Text>
        }
        on={
          <Text className="text-body font-medium text-primary" numberOfLines={1}>
            {name}
          </Text>
        }
      />
    </Pressable>
  );
}
