import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Button } from "@/components/button";
import { RadioMark } from "@/components/choices";
import { StepScreen } from "@/components/step-screen";
import { Text } from "@/components/text";
import { useCancellationFlow } from "@/lib/cancellation-flow";
import { POLICIES } from "@/lib/settings";

// Choosing a cancellation policy, 1 (Figma "Cancellation · 1 Pick a policy", 330:2): the three
// presets, each said in one line, or Custom. Continue goes to the owner's own rules for Custom, and
// straight to the confirm screen for a preset.
export default function PickPolicy() {
  const { t } = useTranslation();
  const { venueId, policy, setPolicy } = useCancellationFlow();

  return (
    <StepScreen
      title={t("screens.setup.settings.policy")}
      subtitle={t("screens.setup.settings.cancellation.subtitle")}
      footer={
        <Button
          label={t("common.actions.continue")}
          disabled={policy === null}
          onPress={() =>
            router.push(
              policy === "CUSTOM"
                ? `/setup/${venueId}/settings/cancellation/custom`
                : `/setup/${venueId}/settings/cancellation/confirm`,
            )
          }
        />
      }
    >
      <View accessibilityRole="radiogroup" className="border-t border-border">
        {POLICIES.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: option === policy }}
            onPress={() => setPolicy(option)}
            className="flex-row items-center gap-3 border-b border-border py-4 active:opacity-60"
          >
            <View className="flex-1">
              <Text className="text-subtitle font-medium">
                {t(`screens.setup.settings.cancellation.policies.${option}.title`)}
              </Text>
              <Text className="mt-[3px] text-label leading-[1.43] text-ink-2">
                {t(`screens.setup.settings.cancellation.policies.${option}.body`)}
              </Text>
            </View>
            <RadioMark selected={option === policy} />
          </Pressable>
        ))}
      </View>
    </StepScreen>
  );
}
