import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, View } from "react-native";
import { Button } from "@/components/button";
import { IconAlertCircle } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { colors } from "@/lib/colors";
import { contactSupport, hasSupport } from "@/lib/support";

// A suspended (temporary) or banned (permanent) account, after the right password: no way back
// in from here, only support. The icon, title and why sit centred on the screen, in the title's and
// subtitle's styles; Back to sign in is pinned to the bottom, last.
export default function Blocked() {
  const { t } = useTranslation();
  const { kind } = useLocalSearchParams<{ kind: "suspended" | "banned" }>();
  const copy = kind === "banned" ? "banned" : "suspended";

  // Only the button leaves: no swipe back on iOS, and Android's back button does nothing here.
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
            <Button label={t("common.actions.contactSupport")} onPress={contactSupport} />
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
      {/* Centred in the space above the buttons: there's nothing to do here but read it. */}
      <View className="flex-1 items-center justify-center">
        <IconAlertCircle size={40} color={colors.unit} strokeWidth={1.75} />
        <Text
          accessibilityRole="header"
          className="mb-2 mt-3.5 text-center text-title font-semibold tracking-[-0.4px]"
        >
          {t(`screens.blocked.${copy}.title`)}
        </Text>
        <Text className="text-center text-subtitle text-ink-2">
          {t(`screens.blocked.${copy}.body`)}
        </Text>
      </View>
    </Screen>
  );
}
