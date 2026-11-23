import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { IconBell } from "@/components/icons";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { colors } from "@/lib/colors";

// Notifications, opened from Home's bell (user, 2026-11-24). The inbox and its API come with
// Phase 7.1 (docs/plan.md); until then this is its empty state, laid out like Favorites'.
export default function Notifications() {
  const { t } = useTranslation();
  return (
    <Screen>
      <NavBar start={<BackButton onPress={() => router.back()} />} />
      <Title>{t("screens.notifications.title")}</Title>
      <View className="flex-1 items-center justify-center px-5 pb-32">
        <View className="size-[120px] items-center justify-center rounded-full bg-[#0b0b0c12]">
          <IconBell size={48} color={colors.ink} strokeWidth={1.5} />
        </View>
        <Text className="mt-6 text-center text-heading font-semibold">
          {t("screens.notifications.empty.title")}
        </Text>
        <Text className="mt-2 text-center text-subtitle text-ink-2">
          {t("screens.notifications.empty.body")}
        </Text>
      </View>
    </Screen>
  );
}
