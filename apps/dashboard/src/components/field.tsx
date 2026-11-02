import { useState, type ReactNode } from "react";
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

export function FieldLabel({ children }: { children: string }) {
  return <Text className="mb-2 text-label font-medium text-ink-2">{children}</Text>;
}

export const inputClass = "h-full flex-1 text-[17px] text-ink";

interface FieldProps extends Omit<TextInputProps, "className" | "style"> {
  label?: string;
  error?: string;
  // Something after the input, like the show-password eye.
  trailing?: ReactNode;
}

// A labelled text input. Errors are the person's to fix, so they sit right under the field.
export function Field({ label, error, trailing, onFocus, onBlur, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View className={error ? "" : "mb-4"}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
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
