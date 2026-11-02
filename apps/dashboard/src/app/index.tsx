import { View } from "react-native";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { t } from "@/lib/i18n";

// Styling check (NativeWind 5 on Expo 58, in Expo Go): the pill button in every state and the three
// weights, in the device's language. In Arabic the whole screen is right-to-left in Noto Sans Arabic.
export default function Home() {
  return (
    <Screen>
      <Text className="mt-6 text-title font-semibold">{t("styleCheckTitle")}</Text>
      <Text className="mt-1.5 text-subtitle text-ink-2">{t("styleCheckSubtitle")}</Text>

      <View className="mt-8 gap-2.5">
        <Button label={t("createAccount")} />
        <Button label={t("createVenue")} variant="secondary" />
        <Button label={t("haveCode")} variant="ghost" />
        <Button label={t("continue")} disabled />
      </View>

      {/* The label in regular, then "Aa" in medium and semibold. */}
      <View className="mt-8 h-14 flex-row items-center rounded-field border border-border px-4">
        <View className="size-6 rounded-full bg-primary" />
        <Text className="ms-3 text-subtitle">{t("weights")}</Text>
        <Text className="ms-2 text-subtitle font-medium">Aa</Text>
        <Text className="ms-2 text-subtitle font-semibold">Aa</Text>
      </View>
    </Screen>
  );
}
