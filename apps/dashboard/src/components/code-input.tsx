import { useRef, useState, type ComponentRef } from "react";
import { Pressable, TextInput, View } from "react-native";
import { FieldError } from "./field-error";
import { Text } from "./text";

const LENGTH = 6;

interface CodeInputProps {
  value: string;
  onChangeText: (code: string) => void;
  // "digits": the 6-digit WhatsApp codes. "code": invitation codes, letters and digits in capitals.
  kind?: "digits" | "code";
  error?: string;
  // Locked after too many attempts: grey boxes, no typing.
  disabled?: boolean;
  autoFocus?: boolean;
}

// Six boxes driven by one hidden input, so typing, pasting and iOS's code autofill all work. Codes
// read left to right in Arabic too.
export function CodeInput({
  value,
  onChangeText,
  kind = "digits",
  error,
  disabled = false,
  autoFocus,
}: CodeInputProps) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const clean = (text: string) =>
    (kind === "digits"
      ? text.replace(/\D/g, "")
      : text.replace(/[^0-9a-z]/gi, "").toUpperCase()
    ).slice(0, LENGTH);

  return (
    <View className={error ? "" : "mb-[18px]"}>
      <Pressable
        accessibilityRole="none"
        onPress={() => input.current?.focus()}
        disabled={disabled}
        className="flex-row gap-2"
        style={{ direction: "ltr" }}
      >
        {Array.from({ length: LENGTH }, (_, i) => {
          const char = value[i];
          const active = focused && !disabled && i === Math.min(value.length, LENGTH - 1);
          const box = disabled
            ? "border border-field bg-field"
            : error
              ? "border-[1.5px] border-red bg-white"
              : active
                ? "border-[1.5px] border-primary bg-white"
                : "border border-border bg-white";
          return (
            <View
              key={i}
              className={`h-[60px] flex-1 items-center justify-center rounded-field ${box}`}
            >
              {char ? (
                <Text className="text-[26px] font-semibold">{char}</Text>
              ) : active ? (
                <View className="h-[22px] w-0.5 rounded-full bg-primary" />
              ) : null}
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => onChangeText(clean(text))}
        editable={!disabled}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType={kind === "digits" ? "number-pad" : "default"}
        autoCapitalize={kind === "code" ? "characters" : "none"}
        autoCorrect={false}
        textContentType="oneTimeCode"
        autoComplete={kind === "digits" ? "sms-otp" : "off"}
        maxLength={LENGTH}
        caretHidden
        // Off-screen but focusable; the boxes above are what people see.
        style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </View>
  );
}
