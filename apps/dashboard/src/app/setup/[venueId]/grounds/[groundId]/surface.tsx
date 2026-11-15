import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { ChoicePill, ChoicePills, Segmented } from "@/components/choices";
import { SectionHeading, StepScreen } from "@/components/step-screen";
import { Text } from "@/components/text";
import { useGroundFlow } from "@/lib/ground-flow";
import { ENVIRONMENTS, SURFACES } from "@/lib/grounds";

// Adding a ground, 2 of 4 (Figma "Grounds · Add 2 Surface and cover", 353:2): what players filter
// by. Surfaces are a list, so they wrap as pills; outdoor → covered → indoor is a scale, so it's
// one segmented control, with a line under it saying what the chosen one means.
export default function GroundSurface() {
  const { t } = useTranslation();
  const { venueId = "", groundId = "new" } = useLocalSearchParams<{
    venueId: string;
    groundId: string;
  }>();
  const { draft, update } = useGroundFlow();

  return (
    <StepScreen
      title={t("screens.setup.grounds.surfaceTitle")}
      subtitle={t("screens.setup.grounds.surfaceSubtitle")}
      footer={
        <Button
          label={t("common.actions.continue")}
          onPress={() => router.push(`/setup/${venueId}/grounds/${groundId}/prices`)}
        />
      }
    >
      <SectionHeading>{t("screens.setup.grounds.surface")}</SectionHeading>
      <ChoicePills>
        {SURFACES.map((surface) => (
          <ChoicePill
            key={surface}
            label={t(`screens.setup.grounds.surfaces.${surface}`)}
            selected={draft.surface === surface}
            onPress={() => update({ surface })}
          />
        ))}
      </ChoicePills>

      <SectionHeading>{t("screens.setup.grounds.cover")}</SectionHeading>
      <Segmented
        options={ENVIRONMENTS}
        value={draft.environment}
        label={(environment) => t(`screens.setup.grounds.environments.${environment}`)}
        onChange={(environment) => update({ environment })}
      />
      <Text className="mt-[27px] text-label leading-[1.43] text-ink-2">
        {t(`screens.setup.grounds.environmentHints.${draft.environment}`)}
      </Text>
    </StepScreen>
  );
}
