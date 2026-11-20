import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, View } from "react-native";
import { Button } from "@/components/button";
import { IconAlertCircle, IconBrandWhatsapp } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { colors } from "@/lib/colors";
import { contactSupport, hasSupport } from "@/lib/support";

// A suspended (temporary) or banned (permanent) account, after the right password: no way back in
// from here, only support. A grey alert icon sits over the title where other screens have the back
// button (the one icon allowed above a title, from the staff app's D1). Its strings live under
// screens.blocked.<kind>.
export default function Blocked() {
  const { kind } = useLocalSearchParams<{ kind: "suspended" | "banned" }>();
  const { t } = useTranslation();
  const copy = kind === "banned" ? "banned" : "suspended";

  // Only the buttons leave: no swipe back on iOS, and Android's back button does nothing here.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => subscription.remove();
    }, []),
  );

  return (
    <Screen
      footer={
        <>
          {hasSupport ? (
            <Button
              label={t("common.actions.contactSupport")}
              icon={<IconBrandWhatsapp size={20} color={colors.white} strokeWidth={2} />}
              onPress={contactSupport}
            />
          ) : null}
          <Button
            label={t("common.actions.backToSignIn")}
            variant={hasSupport ? "ghost" : "secondary"}
            onPress={() => router.dismissTo("/sign-in")}
          />
        </>
      }
    >
      <Stack.Screen options={{ gestureEnabled: false }} />
      {/* Where the back button sits on other screens, so the title lines up with theirs. */}
      <View className="mb-[22px] h-10 justify-center">
        <IconAlertCircle size={32} color={colors.unit} strokeWidth={2} />
      </View>
      <Text accessibilityRole="header" className="mb-2 text-title font-semibold tracking-[-0.4px]">
        {t(`screens.blocked.${copy}.title`)}
      </Text>
      <Text className="text-subtitle text-ink-2">{t(`screens.blocked.${copy}.body`)}</Text>
    </Screen>
  );
}
