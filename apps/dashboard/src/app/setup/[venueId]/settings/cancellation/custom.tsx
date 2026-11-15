import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { StepScreen } from "@/components/step-screen";
import { useCancellationFlow } from "@/lib/cancellation-flow";

// Choosing a cancellation policy, 2, for Custom only. The rules editor was taken out (user,
// 2026-11-15) while new designs are drawn in Figma; until one is picked, Continue carries the
// flow's current custom rules (its starting set, or the venue's saved ones) to the confirm step.
export default function CustomRules() {
  const { t } = useTranslation();
  const { venueId } = useCancellationFlow();
  return (
    <StepScreen
      title={t("screens.setup.settings.custom.title")}
      subtitle={t("screens.setup.settings.custom.subtitle")}
      footer={
        <Button
          label={t("common.actions.continue")}
          onPress={() => router.push(`/setup/${venueId}/settings/cancellation/confirm`)}
        />
      }
    >
      {null}
    </StepScreen>
  );
}
