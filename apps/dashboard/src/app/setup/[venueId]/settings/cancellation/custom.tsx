import { router } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, TextInput, View } from "react-native";
import { Button } from "@/components/button";
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

// A rule on screen: its fields as typed, and an id of its own that it keeps, so a rule's fields
// (and the one being typed in) stay with that rule when one above it is removed.
type Rule = TierDraft & { id: number };

export default function CustomRules() {
  const { t } = useTranslation();
  const { venueId, customTiers, setCustomTiers } = useCancellationFlow();
  const nextId = useRef(0);
  const rule = (draft: TierDraft): Rule => ({ ...draft, id: nextId.current++ });
  const [drafts, setDrafts] = useState<Rule[]>(() =>
    customTiers.map((tier) => rule(draftOf(tier))),
  );
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
    setDrafts([...drafts, rule(draftOf(nextTier(tiers[tiers.length - 1])))]);
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
          <View key={draft.id} className="border-b border-border pb-3.5">
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
            <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1.5">
              <Text className="text-subtitle">
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
            <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1.5 pt-2.5">
              <Text className="text-subtitle">{t("screens.setup.settings.custom.getBack")}</Text>
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

// A number set into the sentence ("Cancel at least [24 hours] before"): a small outlined box the
// height of a line, its value at the sentence's own size and its unit in grey after it, so the rule
// reads as words with a blank filled in rather than a form. Blue outline while typing, red with a
// problem; the padding gives up the half pixel the thicker outline takes, so nothing moves.
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
  const outline = error
    ? "border-[1.5px] border-red px-[9.5px]"
    : focused
      ? "border-[1.5px] border-primary px-[9.5px]"
      : "border border-border px-2.5";
  return (
    <View
      className={`h-[34px] flex-row items-center gap-1 rounded-[9px] bg-white ${outline}`}
      style={{ direction: "ltr" }}
    >
      <TextInput
        accessibilityLabel={`${label}, ${unit}`}
        className="h-full min-w-4 p-0 text-subtitle font-medium text-ink"
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
      <Text className="text-label text-ink-2">{unit}</Text>
    </View>
  );
}
