import { ActivityIndicator, Pressable } from "react-native";
import { colors } from "@/lib/colors";
import { Text } from "./text";

// The pill button from the Figma screens: 56 high, fully round, 17/600 label.
const variants = {
  primary: { box: "bg-primary", label: "text-on-primary" },
  secondary: { box: "bg-chip", label: "text-ink" },
  ghost: { box: "bg-transparent", label: "text-ink" },
  // On the blue onboarding slides.
  inverse: { box: "bg-white", label: "text-primary" },
  inverseSecondary: { box: "bg-white/15", label: "text-white" },
} as const;

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: keyof typeof variants;
  disabled?: boolean;
  // Waiting on the server: a spinner replaces the label, the button keeps its size and colour and
  // can't be pressed again.
  loading?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}: ButtonProps) {
  const style = disabled ? { box: "bg-field", label: "text-ink-3" } : variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      className={`h-14 items-center justify-center rounded-full px-6 active:opacity-80 ${style.box}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.onPrimary : colors.ink} />
      ) : (
        <Text className={`text-center text-button font-semibold ${style.label}`}>{label}</Text>
      )}
    </Pressable>
  );
}
