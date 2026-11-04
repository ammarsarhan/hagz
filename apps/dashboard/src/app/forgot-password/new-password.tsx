import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/button";
import { useHud } from "@/components/hud";
import { IconCircleCheck } from "@/components/icons";
import { BackButton, NavBar } from "@/components/nav";
import { PasswordField } from "@/components/password-field";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api, auth } from "@/lib/api";
import { hudMessage, problem, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { leaveToOnboarding } from "@/lib/navigation";

const MIN_PASSWORD = 8;

// Reset, last step: the new password, with the reset token from the code (or from the sign-up
// verification), or from the account screen. Setting it signs out every device; then back to sign
// in with the number filled in.
export default function ResetNewPassword() {
  const { t } = useTranslation();
  const { phone = "", resetToken = "" } = useLocalSearchParams<{
    phone: string;
    resetToken: string;
  }>();
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const hud = useHud();
  const longEnough = password.length >= MIN_PASSWORD;

  const reset = async () => {
    setSaving(true);
    const result = await send(
      api.POST("/v1/auth/staff/password-resets/confirm", {
        body: { resetToken, newPassword: password },
      }),
    );
    setSaving(false);
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      // An expired reset starts over from the number.
      if (problem(result.error)?.code === "RESET_TOKEN_INVALID") {
        router.dismissTo({ pathname: "/forgot-password", params: { phone } });
      }
      return;
    }
    // From the account screen: the reset signed this phone out along with every other, so it starts
    // over at sign in, over onboarding, with nothing signed-in left to go back to. The session is
    // only forgotten here, not signed out: the server already ended it, and asking again would answer
    // SESSION_ENDED and send the app to onboarding a second time, racing this navigation.
    if (await auth.isSignedIn()) {
      await auth.forget();
      leaveToOnboarding();
      router.push({ pathname: "/sign-in", params: { phone } });
      return;
    }
    router.dismissTo({ pathname: "/sign-in", params: { phone } });
  };

  return (
    <Screen
      footer={
        <Button
          label={t("screens.forgotPassword.newPassword.submit")}
          disabled={!longEnough}
          loading={saving}
          onPress={() => void reset()}
        />
      }
    >
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      <Title subtitle={t("screens.forgotPassword.newPassword.subtitle")}>
        {t("screens.forgotPassword.newPassword.title")}
      </Title>
      <PasswordField
        label={t("screens.forgotPassword.newPassword.newPassword")}
        value={password}
        onChangeText={setPassword}
        isNew
      />
      <View className="-mt-1.5 flex-row items-center gap-1.5">
        <IconCircleCheck
          size={16}
          color={longEnough ? colors.green : colors.ink3}
          strokeWidth={2}
        />
        <Text className={`text-label ${longEnough ? "text-green" : "text-ink-2"}`}>
          {t("screens.signUp.details.passwordRule")}
        </Text>
      </View>
    </Screen>
  );
}
