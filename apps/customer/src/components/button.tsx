import type { ReactNode } from "react";
import { ActivityIndicator, Keyboard, Pressable, View } from "react-native";
import { colors } from "@/lib/colors";
import { Text } from "./text";

// The pill button from the Figma screens: 56 high, fully round, 17/600 label. Black for everyday
// actions; lime only for the few big moments (Create account, later Book and Pay), the user's rule
// from 2026-11-19. Pressing it closes the keyboard first, so what the action shows next (an error,
// a HUD, the next step) isn't behind it.
const variants = {
  ink: { box: "bg-ink", label: "text-white", spinner: colors.white },
  // The big moments: lime with a black label.
  moment: { box: "bg-primary", label: "text-on-primary", spinner: colors.ink },
  // Grey: the quieter of two choices (Sign in under Create account).
  secondary: { box: "bg-chip", label: "text-ink", spinner: colors.ink },
  ghost: { box: "bg-transparent", label: "text-ink", spinner: colors.ink },
  // On the lime onboarding slides.
  white: { box: "bg-white", label: "text-ink", spinner: colors.ink },
} as const;

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: keyof typeof variants;
  disabled?: boolean;
  // Waiting on the server: a spinner replaces the label, the button keeps its size and colour and
  // can't be pressed again.
  loading?: boolean;
  // An icon before the label (WhatsApp on Contact support).
  icon?: ReactNode;
}

export function Button({
  label,
  onPress,
  variant = "ink",
  disabled = false,
  loading = false,
  icon,
}: ButtonProps) {
  const style = variants[variant];
  const look = disabled ? { box: "bg-chip", label: "text-ink-3" } : style;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      onPress={() => {
        Keyboard.dismiss();
        onPress?.();
      }}
      className={`h-14 items-center justify-center rounded-full px-6 active:opacity-80 ${look.box}`}
    >
      {loading ? (
        <ActivityIndicator color={style.spinner} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon}
          <Text className={`text-center text-button font-semibold ${look.label}`}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
