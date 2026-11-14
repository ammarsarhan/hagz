import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TextInput, View, type TextInputProps } from "react-native";
import { colors } from "@/lib/colors";
import { FieldError } from "./field-error";
import { Text } from "./text";

// The box every input sits in: white, 56 high, 1px light border, 14 corners; 1.5px blue when
// focused, red with an error. Padding shrinks by the extra half pixel so the text doesn't move.
export function FieldBox({
  focused,
  error,
  children,
  ltr = false,
}: {
  focused: boolean;
  error: boolean;
  children: ReactNode;
  ltr?: boolean;
}) {
  const border = error
    ? "border-[1.5px] border-red px-[15.5px]"
    : focused
      ? "border-[1.5px] border-primary px-[15.5px]"
      : "border border-border px-4";
  return (
    <View
      className={`h-14 flex-row items-center gap-2.5 rounded-field bg-white ${border}`}
      style={ltr ? { direction: "ltr" } : undefined}
    >
      {children}
    </View>
  );
}

// A required field's label ends in an asterisk, in the label's own grey: the staff app has no red
// for status (emphasis is weight), and the asterisk is a convention people read without colour.
// Screen readers hear "required" instead of "star".
export function FieldLabel({
  children,
  required = false,
}: {
  children: string;
  required?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Text
      className="mb-2 text-label font-medium text-ink-2"
      accessibilityLabel={
        required ? `${children}, ${t("components.shared.field.required")}` : undefined
      }
    >
      {children}
      {required ? " *" : null}
    </Text>
  );
}

export const inputClass = "h-full flex-1 text-[16px] text-ink";

interface FieldProps extends Omit<TextInputProps, "className" | "style"> {
  label?: string;
  required?: boolean;
  error?: string;
  // Something after the input, like the show-password eye.
  trailing?: ReactNode;
}

// A labelled text input. Errors are the person's to fix, so they sit right under the field.
export function Field({ label, required, error, trailing, onFocus, onBlur, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View className={error ? "" : "mb-4"}>
      {label ? <FieldLabel required={required}>{label}</FieldLabel> : null}
      <FieldBox focused={focused} error={Boolean(error)}>
        <TextInput
          className={inputClass}
          placeholderTextColor={colors.ink3}
          selectionColor={colors.primary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...input}
        />
        {trailing}
      </FieldBox>
      {error ? <FieldError>{error}</FieldError> : null}
    </View>
  );
}

// A longer answer (a venue's description): the field's box, growing from four lines, text from the
// top. The count of what's left sits under it on the end side, like the name step's.
const PAD_Y = 10;

export function TextArea({
  label,
  required,
  value,
  maxLength,
  onChangeText,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  maxLength: number;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const border = focused
    ? "border-[1.5px] border-primary px-[15.5px]"
    : "border border-border px-4";
  return (
    <View className="mb-4">
      <FieldLabel required={required}>{label}</FieldLabel>
      <TextInput
        className={`min-h-[120px] rounded-field bg-white text-[16px] leading-[1.35] text-ink ${border}`}
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        multiline
        textAlignVertical="top"
        placeholder={placeholder}
        placeholderTextColor={colors.ink3}
        selectionColor={colors.primary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // As a style, not py-*: that compiles to paddingBlock, which a multiline input on iOS
        // ignores. With the line's own leading on top, this puts the first line's letters as far
        // from the top edge as from the side.
        style={{
          paddingTop: (focused ? -0.5 : 0) + PAD_Y,
          paddingBottom: (focused ? -0.5 : 0) + PAD_Y,
        }}
      />
      <Text className="mt-2 self-end text-caption text-ink-3">{`${value.length}/${maxLength}`}</Text>
    </View>
  );
}
