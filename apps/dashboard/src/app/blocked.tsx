import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, View } from "react-native";
import { Button } from "@/components/button";
import { IconAlertCircle } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { colors } from "@/lib/colors";
import { contactSupport, hasSupport } from "@/lib/support";

// A suspended (temporary) or banned (permanent) account, after the right password: no way back
// in from here, only support. The one place with an icon above the title, in plain grey.
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
      {/* No back button: the 40px icon takes the nav row's place, so the title sits where it does on
          other screens. */}
      <View className="mb-[22px]">
        <IconAlertCircle size={40} color={colors.unit} strokeWidth={1.75} />
      </View>
      <Title subtitle={t(`screens.blocked.${copy}.body`)}>
        {t(`screens.blocked.${copy}.title`)}
      </Title>
    </Screen>
  );
}
