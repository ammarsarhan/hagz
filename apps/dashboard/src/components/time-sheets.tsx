import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { amountOf, cleanAmount, decimalsOf, formatAmount, minorOf } from "@/lib/money";
import { Button } from "./button";
import { Field } from "./field";
import { MoneyField } from "./money-field";
import { Sheet } from "./sheet";
import { Text } from "./text";

// The small sheets a time's own page (app/time.tsx) opens: its price, and a closed time's note.

// A price for each hour picked. Save stays grey until it differs from what they cost now.
export function PriceSheet({
  title,
  current,
  currency,
  visible,
  busy,
  onClose,
  onHidden,
  onSave,
}: {
  title: string;
  // What each costs now, when they all cost the same; null when they differ.
  current: number | null;
  currency: string;
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onHidden: () => void;
  onSave: (price: number) => void;
}) {
  const { t } = useTranslation();
  const decimals = decimalsOf(currency);
  const [price, setPrice] = useState(() => (current === null ? "" : amountOf(current, decimals)));
  const value = minorOf(price, decimals);
  const ready = Number.isFinite(value) && value >= 0 && value !== current;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={onHidden}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t("screens.calendar.timeSheet.priceTitle")}
      </Text>
      <Text className="mt-1.5 mb-6 text-body text-ink-2">
        {t("screens.calendar.timeSheet.priceSheetBody", { time: title })}
      </Text>
      <MoneyField
        label={t("screens.calendar.timeSheet.priceLabel")}
        currency={currency}
        decimals={decimals}
        value={price}
        onChangeText={(text) => setPrice(cleanAmount(text, decimals))}
      />
      <View className="mt-2">
        <Button
          label={t("screens.calendar.timeSheet.save")}
          disabled={!ready}
          loading={busy}
          onPress={() => onSave(value)}
        />
      </View>
    </Sheet>
  );
}

// Closed hours' note for the team. Empty removes it; Save stays grey until it changes.
export function NoteSheet({
  note,
  visible,
  busy,
  onClose,
  onHidden,
  onSave,
}: {
  note: string | null;
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onHidden: () => void;
  onSave: (note: string | null) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(note ?? "");
  const next = text.trim() === "" ? null : text.trim();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={onHidden}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
        {t("screens.calendar.timeSheet.noteTitle")}
      </Text>
      <Text className="mt-1.5 mb-6 text-body text-ink-2">
        {t("screens.calendar.timeSheet.noteBody")}
      </Text>
      <Field
        label={t("screens.calendar.timeSheet.noteLabel")}
        value={text}
        onChangeText={setText}
        placeholder={t("screens.calendar.timeSheet.notePlaceholder")}
        maxLength={200}
      />
      <View className="mt-2">
        <Button
          label={t("screens.calendar.timeSheet.save")}
          disabled={next === note}
          loading={busy}
          onPress={() => onSave(next)}
        />
      </View>
    </Sheet>
  );
}

// "1,800 EGP".
export const moneyOf = (minor: number, currency: string) =>
  `${formatAmount(minor, decimalsOf(currency))} ${currency}`;
