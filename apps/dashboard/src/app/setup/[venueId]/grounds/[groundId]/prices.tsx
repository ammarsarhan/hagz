import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { MoneyField } from "@/components/money-field";
import { StepScreen } from "@/components/step-screen";
import { useGroundFlow, type GroundDraft } from "@/lib/ground-flow";
import { minorOf } from "@/lib/money";

// Adding a ground, 3 of 4 (Figma "Grounds · Add 3 Prices", 368:2): per hour, in the marketplace's
// currency. Only the normal price is needed; peak and discount are for the hours the owner marks
// with them in opening hours, so they're optional here.
//
// The API takes any three prices. The app holds peak above normal and discount below it: the other
// way round, players would pay more for "discounted" hours, which is never what's meant.
type PriceKey = "basePrice" | "peakPrice" | "discountPrice";
type Errors = Partial<Record<PriceKey, string>>;

export default function GroundPrices() {
  const { t } = useTranslation();
  const { venueId = "", groundId = "new" } = useLocalSearchParams<{
    venueId: string;
    groundId: string;
  }>();
  const { draft, update, currency, decimals } = useGroundFlow();
  const [errors, setErrors] = useState<Errors>({});

  const check = (prices: GroundDraft): Errors => {
    const base = minorOf(prices.basePrice, decimals);
    const peak = minorOf(prices.peakPrice, decimals);
    const discount = minorOf(prices.discountPrice, decimals);
    const found: Errors = {};
    if (!(base >= 1)) found.basePrice = t("screens.setup.grounds.priceRequired");
    else {
      if (peak <= base) found.peakPrice = t("screens.setup.grounds.peakTooLow");
      if (discount >= base) found.discountPrice = t("screens.setup.grounds.discountTooHigh");
    }
    return found;
  };

  // A field's error goes as soon as it's edited; the rest wait for the next Continue.
  const change = (key: PriceKey) => (value: string) => {
    update({ [key]: value });
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };

  const field = (key: PriceKey) => ({
    value: draft[key],
    onChangeText: change(key),
    error: errors[key],
    currency,
    decimals,
    unit: t("screens.setup.grounds.perHourUnit"),
  });

  return (
    <StepScreen
      title={t("screens.setup.grounds.pricesTitle")}
      subtitle={t("screens.setup.grounds.pricesSubtitle")}
      footer={
        <Button
          label={t("common.actions.continue")}
          onPress={() => {
            const found = check(draft);
            setErrors(found);
            if (Object.keys(found).length === 0) {
              router.push(`/setup/${venueId}/grounds/${groundId}/length`);
            }
          }}
        />
      }
    >
      <MoneyField
        {...field("basePrice")}
        label={t("screens.setup.grounds.normalPrice")}
        placeholder={t("screens.setup.grounds.example", { amount: 600 })}
        autoFocus={draft.basePrice === ""}
      />
      <MoneyField
        {...field("peakPrice")}
        label={t("screens.setup.grounds.peakPrice")}
        optional
        placeholder={t("screens.setup.grounds.example", { amount: 800 })}
        hint={t("screens.setup.grounds.peakHint")}
      />
      <MoneyField
        {...field("discountPrice")}
        label={t("screens.setup.grounds.discountPrice")}
        optional
        placeholder={t("screens.setup.grounds.example", { amount: 500 })}
        hint={t("screens.setup.grounds.discountHint")}
      />
    </StepScreen>
  );
}
