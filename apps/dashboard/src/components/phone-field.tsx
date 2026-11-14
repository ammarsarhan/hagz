import { useState } from "react";
import { TextInput, View } from "react-native";
import { colors } from "@/lib/colors";
import { FieldBox, FieldLabel, inputClass } from "./field";
import { FieldError } from "./field-error";
import { IconChevronDown } from "./icons";
import { Text } from "./text";

// Egyptian mobile numbers: 10 digits after +20, shown grouped as typed (100 123 4567).
const MAX_DIGITS = 10;
// The grouped text holds two spaces, so the input stops at 12 characters: a native limit, so an
// 11th digit never appears instead of appearing and being cut.
const MAX_LENGTH = MAX_DIGITS + 2;
export const formatPhone = (digits: string) =>
  [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, MAX_DIGITS)].filter(Boolean).join(" ");

interface PhoneFieldProps {
  // Just the digits after +20, e.g. "1001234567".
  value: string;
  onChangeText: (digits: string) => void;
  label?: string;
  error?: string;
}

// The country code sits before the number in grey, like a unit. Phone numbers read left to right
// in Arabic too, so the box keeps that direction.
export function PhoneField({ value, onChangeText, label, error }: PhoneFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View className={error ? "" : "mb-4"}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <FieldBox focused={focused} error={Boolean(error)} ltr>
        <View className="flex-row items-center gap-0.5">
          <Text className="text-[16px] text-unit">+20</Text>
          <IconChevronDown size={16} color={colors.unit} strokeWidth={2} />
        </View>
        <TextInput
          className={inputClass}
          value={formatPhone(value)}
          onChangeText={(text) => onChangeText(text.replace(/\D/g, "").slice(0, MAX_DIGITS))}
          placeholder="100 000 0000"
          placeholderTextColor={colors.ink3}
          selectionColor={colors.primary}
          maxLength={MAX_LENGTH}
          keyboardType="number-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ textAlign: "left", writingDirection: "ltr" }}
        />
      </FieldBox>
      {error ? <FieldError>{error}</FieldError> : null}
    </View>
  );
}
