import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TextInput, View } from "react-native";
import { colors } from "@/lib/colors";
import { cleanAmount } from "@/lib/money";
import { FieldBox, inputClass } from "./field";
import { FieldError } from "./field-error";
import { Text } from "./text";

// An amount of money (Figma "Grounds · Add 3 Prices", 368:2): the currency before the digits and a
// unit after them ("per hour"), both in grey. Digits run left to right in either language, like the
// phone field. An optional field says so after its label rather than with an asterisk on the
// others; a hint under it gives way to an error.
export function MoneyField({
  label,
  optional = false,
  currency,
  decimals,
  unit,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  autoFocus,
}: {
  label: string;
  optional?: boolean;
  currency: string;
  decimals: number;
  unit?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  return (
    // FieldError brings its own space below.
    <View className={error ? "" : "mb-4"}>
      <Text className="mb-2 text-label text-ink-2">
        <Text className="text-label font-medium text-ink-2">{label}</Text>
        {optional ? (
          <Text className="text-label text-ink-3">{` ${t("screens.setup.grounds.optional")}`}</Text>
        ) : null}
      </Text>
      <FieldBox focused={focused} error={Boolean(error)} ltr>
        <Text className="text-[16px] text-unit">{currency}</Text>
        <TextInput
          accessibilityLabel={label}
          className={inputClass}
          value={value}
          onChangeText={(text) => onChangeText(cleanAmount(text, decimals))}
          keyboardType={decimals > 0 ? "decimal-pad" : "number-pad"}
          placeholder={placeholder}
          placeholderTextColor={colors.ink3}
          selectionColor={colors.primary}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ textAlign: "left", writingDirection: "ltr" }}
        />
        {unit ? <Text className="text-body text-ink-2">{unit}</Text> : null}
      </FieldBox>
      {error ? (
        <FieldError>{error}</FieldError>
      ) : hint ? (
        <Text className="mt-1.5 text-label leading-[1.43] text-ink-2">{hint}</Text>
      ) : null}
    </View>
  );
}
