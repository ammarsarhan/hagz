import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
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
import { useTranslation } from "react-i18next";
import { enterApp } from "@/lib/session";

const MIN_PASSWORD = 8;

// Sign up, step 3: name and password, then the account is created and signed in. Numbers that
// already have an account were sent to "already registered" after the code; this still handles one
// registered in the meantime (on another device). An expired verification goes back to the phone.
export default function SignUpDetails() {
  const { t } = useTranslation();
  const { phone = "", token = "" } = useLocalSearchParams<{ phone: string; token: string }>();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const hud = useHud();
  const longEnough = password.length >= MIN_PASSWORD;

  const createAccount = async () => {
    setLoading(true);
    const result = await send(
      api.POST("/v1/auth/staff/sign-up", {
        body: { verificationToken: token, name: name.trim(), password },
      }),
    );
    setLoading(false);
    if (!result.ok) {
      const failure = problem(result.error)?.code;
      if (failure === "PHONE_ALREADY_REGISTERED") {
        router.replace({ pathname: "/sign-up/registered", params: { phone } });
      } else if (failure === "VERIFICATION_TOKEN_INVALID") {
        router.dismissTo("/sign-up");
        hud.show(hudMessage(result.error));
      } else {
        hud.show(hudMessage(result.error));
      }
      return;
    }
    // Busy until first run is ready, so the button doesn't flick back first.
    setLoading(true);
    await auth.start(result.data.session);
    await enterApp();
  };

  return (
    <Screen
      footer={
        <Button
          label={t("common.actions.createAccount")}
          disabled={!name.trim() || !longEnough}
          loading={loading}
          onPress={() => void createAccount()}
        />
      }
    >
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      <Title subtitle={t("screens.signUp.details.subtitle")}>
        {t("screens.signUp.details.title")}
      </Title>
      <Field
        label={t("common.fields.fullName")}
        value={name}
        onChangeText={setName}
        textContentType="name"
        autoComplete="name"
        maxLength={100}
      />
      <PasswordField
        label={t("common.fields.password")}
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
