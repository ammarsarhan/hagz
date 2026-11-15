import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/button";
import { StepScreen } from "@/components/step-screen";
import { Text } from "@/components/text";
import { useCancellationFlow } from "@/lib/cancellation-flow";
import { refundRows } from "@/lib/settings";

// Choosing a cancellation policy, last (Figma "Cancellation · 3 Confirm", 332:2): the policy as
// players will see it, a table of how much comes back for how much notice, then Save. Save stays
// grey when it's the policy the venue already has.
export default function ConfirmPolicy() {
  const { t } = useTranslation();
  const { venueName, policy, tiers, changed, save, saving } = useCancellationFlow();
  if (!policy) return null;

  return (
    <StepScreen
      title={t(`screens.setup.settings.cancellation.policies.${policy}.title`)}
      subtitle={t("screens.setup.settings.cancellation.confirmSubtitle", { venue: venueName })}
      footer={
        <Button
          label={t("screens.setup.settings.cancellation.save")}
          disabled={!changed}
          loading={saving}
          onPress={() => void save()}
        />
      }
    >
      <View className="border-t border-border">
        <View className="flex-row justify-between border-b border-border py-2.5">
          <Text className="text-label font-medium text-ink-2">
            {t("screens.setup.settings.cancellation.whenHeading")}
          </Text>
          <Text className="text-label font-medium text-ink-2">
            {t("screens.setup.settings.cancellation.refundHeading")}
          </Text>
        </View>
        {refundRows(t, tiers).map((row) => (
          <View
            key={row.key}
            accessible
            className="flex-row justify-between gap-4 border-b border-border py-[15px]"
          >
            <Text className="flex-1 text-subtitle">{row.when}</Text>
            {row.refund > 0 ? (
              <Text className="text-subtitle font-medium">
                {t("screens.setup.settings.cancellation.percent", { percent: row.refund })}
              </Text>
            ) : (
              <Text className="text-subtitle font-medium text-ink-2">
                {t("screens.setup.settings.cancellation.none")}
              </Text>
            )}
          </View>
        ))}
      </View>
      <View className="gap-2 pt-[18px]">
        <Text className="text-label leading-[1.43] text-ink-2">
          {t("screens.setup.settings.cancellation.venueCancels")}
        </Text>
        <Text className="text-label leading-[1.43] text-ink-2">
          {t("screens.setup.settings.cancellation.onlyNew")}
        </Text>
      </View>
    </StepScreen>
  );
}
