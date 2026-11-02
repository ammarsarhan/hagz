import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { colors } from "@/lib/colors";
import { t } from "@/lib/i18n";
import { IconClock } from "./icons";
import { Text } from "./text";

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// "Resend code in 0:42" counting down from the API's resendAfter, then a tappable "Resend code".
// Give it a new `key` when a code is sent again, to restart the countdown.
export function ResendCode({
  resendAfter,
  onResend,
  sending = false,
}: {
  resendAfter: number;
  onResend: () => void;
  sending?: boolean;
}) {
  const [left, setLeft] = useState(resendAfter);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  if (left > 0) {
    return (
      <View className="flex-row items-center gap-1.5">
        <IconClock size={16} color={colors.ink3} strokeWidth={2} />
        <Text className="text-body text-ink-2">{t("resendIn", { time: clock(left) })}</Text>
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" onPress={onResend} disabled={sending} hitSlop={8}>
      <Text className={`text-body font-medium text-primary ${sending ? "opacity-50" : ""}`}>
        {t("resendCode")}
      </Text>
    </Pressable>
  );
}
