import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, TextInput, View } from "react-native";
import { Button } from "@/components/button";
import { FieldBox } from "@/components/field";
import { FieldError } from "@/components/field-error";
import { IconPlus } from "@/components/icons";
import { StepScreen } from "@/components/step-screen";
import { Text } from "@/components/text";
import { useCancellationFlow } from "@/lib/cancellation-flow";
import { colors } from "@/lib/colors";
import {
  MAXIMUM_CANCELLATION_TIERS,
  checkTiers,
  draftOf,
  hasErrors,
  nextTier,
  type TierDraft,
  type TierErrors,
} from "@/lib/settings";

// Choosing a cancellation policy, 2, for Custom only (Figma "Cancellation · 2 Custom rules", 338:2):
// up to five rules, each "cancel at least [24] hours before, players get back [100] %", from the
// most notice to the least. Less notice than the last rule gets nothing back, said under the list.
//
// Problems show under their fields on Continue, and each goes as soon as its field is edited, as on
// a ground's prices. Removing a rule isn't drawn in Figma: an underlined "Remove" on its label line.
export default function CustomRules() {
  const { t } = useTranslation();
  const { venueId, customTiers, setCustomTiers } = useCancellationFlow();
  const [drafts, setDrafts] = useState<TierDraft[]>(() => customTiers.map(draftOf));
  const [errors, setErrors] = useState<TierErrors>([]);
  const last = drafts[drafts.length - 1];
  const lastHours = last ? Number(last.hours) : NaN;

  const change = (index: number, key: keyof TierDraft, value: string) => {
    setDrafts(drafts.map((draft, i) => (i === index ? { ...draft, [key]: value } : draft)));
    const field = key === "hours" ? "hours" : "percent";
    if (errors[index]?.[field]) {
      setErrors(errors.map((error, i) => (i === index ? { ...error, [field]: undefined } : error)));
    }
  };

  const add = () => {
    const { tiers } = checkTiers(t, drafts);
    setDrafts([...drafts, draftOf(nextTier(tiers[tiers.length - 1]))]);
  };

  const remove = (index: number) => {
    setDrafts(drafts.filter((_, i) => i !== index));
    setErrors(errors.filter((_, i) => i !== index));
  };

  const next = () => {
    const checked = checkTiers(t, drafts);
    setErrors(checked.errors);
    if (hasErrors(checked.errors)) return;
    setCustomTiers(checked.tiers);
    router.push(`/setup/${venueId}/settings/cancellation/confirm`);
  };

  return (
    <StepScreen
      title={t("screens.setup.settings.custom.title")}
      subtitle={t("screens.setup.settings.custom.subtitle")}
      footer={<Button label={t("common.actions.continue")} onPress={next} />}
    >
      <View className="gap-3.5">
        {drafts.map((draft, i) => (
          // Keyed by place: rules are only added at the end, and a removed one takes its fields
          // with it.
          <View key={i} className="border-b border-border pb-3.5">
            <View className="flex-row items-center justify-between pb-2">
              <Text className="text-label font-medium text-ink-2">
                {t("screens.setup.settings.custom.rule", { number: i + 1 })}
              </Text>
              {drafts.length > 1 ? (
                <Pressable accessibilityRole="button" hitSlop={8} onPress={() => remove(i)}>
                  <Text className="text-label font-medium underline">
                    {t("screens.setup.settings.custom.remove")}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="w-32 text-subtitle">
                {t("screens.setup.settings.custom.cancelAtLeast")}
              </Text>
              <UnitField
                label={t("screens.setup.settings.custom.cancelAtLeast")}
                value={draft.hours}
                unit={t("screens.setup.settings.custom.hoursUnit")}
                error={Boolean(errors[i]?.hours)}
                onChangeText={(text) => change(i, "hours", text)}
              />
              <Text className="text-subtitle">{t("screens.setup.settings.custom.before")}</Text>
            </View>
            {errors[i]?.hours ? <FieldError>{errors[i].hours}</FieldError> : null}
            <View className="flex-row items-center gap-2 pt-2">
              <Text className="w-32 text-subtitle">
                {t("screens.setup.settings.custom.getBack")}
              </Text>
              <UnitField
                label={t("screens.setup.settings.custom.getBack")}
                value={draft.percent}
                unit={t("screens.setup.settings.custom.percentUnit")}
                error={Boolean(errors[i]?.percent)}
                onChangeText={(text) => change(i, "percent", text)}
              />
            </View>
            {errors[i]?.percent ? <FieldError>{errors[i].percent}</FieldError> : null}
          </View>
        ))}
      </View>

      {drafts.length < MAXIMUM_CANCELLATION_TIERS ? (
        <Pressable
          accessibilityRole="button"
          onPress={add}
          className="flex-row items-center gap-2 self-start py-[18px] active:opacity-60"
        >
          <IconPlus size={24} color={colors.primary} strokeWidth={1.75} />
          <Text className="text-subtitle font-medium text-primary">
            {t("screens.setup.settings.custom.add")}
          </Text>
        </Pressable>
      ) : (
        <View className="h-[18px]" />
      )}

      {lastHours >= 1 ? (
        <View className="flex-row justify-between gap-4 border-t border-border py-3.5">
          <Text className="flex-1 text-body text-ink-2">
            {t("screens.setup.settings.custom.rest", { count: lastHours })}
          </Text>
          <Text className="text-body font-medium text-ink-2">
            {t("screens.setup.settings.custom.noRefund")}
          </Text>
        </View>
      ) : null}
    </StepScreen>
  );
}

// A small number box with its unit after the digits ("24 hours", "100 %"), sized to what's in it.
function UnitField({
  label,
  value,
  unit,
  error,
  onChangeText,
}: {
  label: string;
  value: string;
  unit: string;
  error: boolean;
  onChangeText: (text: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <FieldBox focused={focused} error={error} ltr>
      <TextInput
        accessibilityLabel={`${label}, ${unit}`}
        className="h-full min-w-6 text-field text-ink"
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, "").slice(0, 3))}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.ink3}
        selectionColor={colors.primary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ textAlign: "left", writingDirection: "ltr" }}
      />
      <Text className="text-body text-ink-2">{unit}</Text>
    </FieldBox>
  );
}
