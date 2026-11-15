import { Pressable, View } from "react-native";
import { colors } from "@/lib/colors";
import { IconMinus, IconPlus } from "./icons";
import { Text } from "./text";

// A whole number nudged up or down between limits (Figma "Grounds · Add 4 Booking length", 369:2):
// round outlined minus and plus around the value. A button at its limit is greyed and does nothing.
// Screen readers get one adjustable control rather than two buttons and a label.
export function Stepper({
  value,
  min,
  max,
  format,
  label,
  decreaseLabel,
  increaseLabel,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  format: (value: number) => string;
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (value: number) => void;
}) {
  const canDecrease = value > min;
  const canIncrease = value < max;
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === "increment" && canIncrease) onChange(value + 1);
        if (nativeEvent.actionName === "decrement" && canDecrease) onChange(value - 1);
      }}
      className="flex-row items-center gap-3"
    >
      <Round
        label={decreaseLabel}
        enabled={canDecrease}
        onPress={() => onChange(value - 1)}
        plus={false}
      />
      <Text className="min-w-9 text-center text-subtitle font-medium">{format(value)}</Text>
      <Round label={increaseLabel} enabled={canIncrease} onPress={() => onChange(value + 1)} plus />
    </View>
  );
}

function Round({
  label,
  enabled,
  plus,
  onPress,
}: {
  label: string;
  enabled: boolean;
  plus: boolean;
  onPress: () => void;
}) {
  const Glyph = plus ? IconPlus : IconMinus;
  return (
    <Pressable
      accessibilityLabel={label}
      disabled={!enabled}
      onPress={onPress}
      hitSlop={6}
      className="size-9 items-center justify-center rounded-full border border-border active:opacity-60"
    >
      <Glyph size={24} strokeWidth={1.5} color={enabled ? colors.ink : colors.ink3} />
    </Pressable>
  );
}
