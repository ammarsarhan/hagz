import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/colors";
import { isRTL } from "@/lib/language";
import { Button } from "./button";
import { BackButton } from "./nav";
import { Text } from "./text";

// A pushed screen whose data isn't in yet: the back button, and a spinner while it loads, or what
// couldn't be read with Try again (See times, Extras).
export function PageState({
  loading = false,
  message = "",
  onRetry,
}: {
  loading?: boolean;
  message?: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 bg-white px-5"
      style={{ paddingTop: insets.top, direction: isRTL ? "rtl" : "ltr" }}
    >
      <StatusBar style="dark" />
      <View className="-mx-1 h-10 justify-center">
        <BackButton onPress={() => router.back()} />
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : (
        <View className="flex-1 justify-center gap-4 px-1 pb-24">
          <Text className="text-subtitle text-ink-2">{message}</Text>
          {onRetry ? (
            <View className="items-start">
              <Button label={t("common.actions.tryAgain")} onPress={onRetry} />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
