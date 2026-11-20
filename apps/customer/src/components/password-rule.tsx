import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { colors } from "@/lib/colors";
import { IconCheck, IconCircleCheck } from "./icons";
import { Text } from "./text";

export const MIN_PASSWORD = 8;

// "At least 8 characters" under a new password: a grey ring until it's long enough, then a black
// tick in a lime disc, the one touch of lime on the account screens (the user, 2026-11-19).
export function PasswordRule({ password }: { password: string }) {
  const { t } = useTranslation();
  const met = password.length >= MIN_PASSWORD;
  return (
    <View className="-mt-1.5 flex-row items-center gap-1.5">
      {met ? (
        <View className="size-4 items-center justify-center rounded-full bg-primary">
          <IconCheck size={11} color={colors.ink} strokeWidth={3} />
        </View>
      ) : (
        <IconCircleCheck size={16} color={colors.ink3} strokeWidth={2} />
      )}
      <Text className={`text-label ${met ? "text-ink" : "text-ink-2"}`}>
        {t("components.passwordRule")}
      </Text>
    </View>
  );
}
