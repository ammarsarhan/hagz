import { useState } from "react";
import { Pressable } from "react-native";
import { colors } from "@/lib/colors";
import { useTranslation } from "react-i18next";
import { Field } from "./field";
import { IconEye, IconEyeOff } from "./icons";

// A password field with the show/hide eye at its end.
export function PasswordField({
  label,
  value,
  onChangeText,
  error,
  isNew = false,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  // New passwords get iOS's strong-password suggestion; existing ones get autofill.
  isNew?: boolean;
}) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  return (
    <Field
      label={label}
      value={value}
      onChangeText={onChangeText}
      error={error}
      secureTextEntry={!shown}
      autoCapitalize="none"
      autoCorrect={false}
      textContentType={isNew ? "newPassword" : "password"}
      autoComplete={isNew ? "new-password" : "current-password"}
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            shown
              ? t("components.shared.passwordField.hide")
              : t("components.shared.passwordField.show")
          }
          onPress={() => setShown(!shown)}
          hitSlop={8}
        >
          {shown ? (
            <IconEye size={20} color={colors.unit} strokeWidth={2} />
          ) : (
            <IconEyeOff size={20} color={colors.unit} strokeWidth={2} />
          )}
        </Pressable>
      }
    />
  );
}
