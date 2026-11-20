import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isRTL } from "@/lib/language";
import { Text } from "./text";

// Stands in for a screen that isn't built yet, so the buttons that lead to it go somewhere real.
// Back returns to where the player came from.
export function ComingSoon({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-white px-6" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <Pressable
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
        className="mt-2 self-start active:opacity-60"
      >
        <Text className="text-subtitle font-medium">{t("components.nav.back")}</Text>
      </Pressable>
      <View className="mt-6 gap-2">
        <Text className="text-title font-semibold">{title}</Text>
        <Text className="text-subtitle text-ink-2">{t("components.comingSoon")}</Text>
      </View>
    </SafeAreaView>
  );
}
