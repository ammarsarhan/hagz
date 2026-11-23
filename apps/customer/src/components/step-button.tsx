import { Pressable } from "react-native";
import { colors } from "@/lib/colors";
import { IconMinus, IconPlus } from "./icons";

// A players stepper's grey round − and + (36, an 18 icon); faded at the end of its range: the
// open game at checkout and on the booker's game.
export function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: "minus" | "plus";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const Glyph = icon === "minus" ? IconMinus : IconPlus;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      className="size-9 items-center justify-center rounded-full bg-chip active:opacity-70"
    >
      <Glyph size={18} color={disabled ? colors.ink3 : colors.ink} strokeWidth={2} />
    </Pressable>
  );
}
