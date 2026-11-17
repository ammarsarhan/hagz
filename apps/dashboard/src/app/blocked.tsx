import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { BLOCKED_ART, BLOCKED_ART_SIZE } from "@/assets/blocked-art";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { contactSupport, hasSupport } from "@/lib/support";

// A suspended (temporary) or banned (permanent) account, after the right password: no way back
// in from here, only support. Its illustration (an account card with a pause or block badge), title
// and why sit centred on the whole screen; Back to sign in is pinned to the bottom, last.
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
    <Screen>
      <Stack.Screen options={{ gestureEnabled: false }} />
      {/* Centred on the whole screen, not the space above the buttons, which sit over its bottom. */}
      <View className="flex-1 items-center justify-center">
        <View
          className="mb-5 w-60"
          style={{ aspectRatio: BLOCKED_ART_SIZE.width / BLOCKED_ART_SIZE.height }}
        >
          <SvgXml xml={BLOCKED_ART[copy]} width="100%" height="100%" />
        </View>
        <Text
          accessibilityRole="header"
          className="mb-2 text-center text-title font-semibold tracking-[-0.4px]"
        >
          {t(`screens.blocked.${copy}.title`)}
        </Text>
        <Text className="text-center text-subtitle text-ink-2">
          {t(`screens.blocked.${copy}.body`)}
        </Text>
      </View>
      {/* Where Screen's footer puts buttons: 12 above the home indicator, Back to sign in last. */}
      <View className="absolute inset-x-5 bottom-3 gap-2.5">
        {hasSupport ? (
          <Button label={t("common.actions.contactSupport")} onPress={contactSupport} />
        ) : null}
        <Button
          label={t("common.actions.backToSignIn")}
          variant={hasSupport ? "ghost" : "secondary"}
          onPress={() => router.dismissTo("/sign-in")}
        />
      </View>
    </Screen>
  );
}
