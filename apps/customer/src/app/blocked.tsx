import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, View } from "react-native";
import { Button } from "@/components/button";
import { BlockedArt } from "@/components/blocked-art";
import { IconBrandWhatsapp } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { colors } from "@/lib/colors";
import { contactSupport, hasSupport } from "@/lib/support";

// A suspended (temporary) or banned (permanent) account, after the right password: no way back in
// from here, only support. Laid out like the staff app's: its illustration (On the bench, or Sent
// off; components/blocked-art.tsx), title and why sit centred above the pinned buttons. Its strings
// live under screens.blocked.<kind>. Sign-in closes the keyboard before coming here: Screen keeps
// its footer above a keyboard that's already open, and nothing here would ever close it.
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
      {/* Centred in what's left of the safe area once the buttons are pinned below it. */}
      <View className="flex-1 items-center justify-center">
        <BlockedArt kind={copy} />
        <Text
          accessibilityRole="header"
          className="mb-2 mt-3 text-center text-title font-semibold tracking-[-0.4px]"
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
