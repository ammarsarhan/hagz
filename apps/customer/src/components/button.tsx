import { Pressable } from "react-native";
import { Text } from "./text";

// The pill button from the Figma screens: 56 high, fully round, 17/600 label. On lime the main
// action is black and the second one white (the onboarding slides).
const variants = {
  ink: { box: "bg-ink", label: "text-white" },
  white: { box: "bg-white", label: "text-ink" },
} as const;

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: keyof typeof variants;
}

export function Button({ label, onPress, variant = "ink" }: ButtonProps) {
  const style = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={`h-14 items-center justify-center rounded-full px-6 active:opacity-80 ${style.box}`}
    >
      <Text className={`text-center text-button font-semibold ${style.label}`}>{label}</Text>
    </Pressable>
  );
}
