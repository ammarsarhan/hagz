import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { ChoicePill, ChoicePills, Segmented } from "@/components/choices";
import { SectionHeading, StepScreen } from "@/components/step-screen";
import { useGroundFlow } from "@/lib/ground-flow";
import { ENVIRONMENTS, SURFACES } from "@/lib/grounds";

// Adding a ground, 2 of 4 (Figma "Grounds · Add 2 Surface and cover", 353:2): what players filter
// by. Surfaces are a list, so they wrap as pills; outdoor → covered → indoor is a scale, so it's
// one segmented control. Each heading has its line under it; Cover's says what the chosen one means.
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
      <SectionHeading description={t("screens.setup.grounds.surfaceBody")}>
        {t("screens.setup.grounds.surface")}
      </SectionHeading>
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

      <SectionHeading
        description={t(`screens.setup.grounds.environmentHints.${draft.environment}`)}
      >
        {t("screens.setup.grounds.cover")}
      </SectionHeading>
      <Segmented
        options={ENVIRONMENTS}
        value={draft.environment}
        label={(environment) => t(`screens.setup.grounds.environments.${environment}`)}
        onChange={(environment) => update({ environment })}
      />
    </StepScreen>
  );
}
