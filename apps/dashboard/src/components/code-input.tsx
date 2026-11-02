import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Animated, Pressable, TextInput, View } from "react-native";
import { colors } from "@/lib/colors";
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
}

// Six boxes driven by one hidden input, so typing, pasting and iOS's code autofill all work. Codes
// read left to right in Arabic too.
export function CodeInput({
  value,
  onChangeText,
  kind = "digits",
  error,
  disabled = false,
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
                // Keyed on the length so every keystroke restarts it solid, like a native caret.
                <Caret key={value.length} />
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

// Blinks like iOS's caret: solid for half a second (and again after every keystroke, via the key
// above), then fades out and back in about once a second.
function Caret() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const blink = Animated.sequence([
      Animated.delay(500),
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: true }),
          Animated.delay(400),
          Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.delay(400),
        ]),
      ),
    ]);
    blink.start();
    return () => blink.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={{ width: 2, height: 22, borderRadius: 1, backgroundColor: colors.primary, opacity }}
    />
  );
}
