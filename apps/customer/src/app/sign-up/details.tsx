import { getCalendars } from "expo-localization";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { useHud } from "@/components/hud";
import { BackButton, NavBar } from "@/components/nav";
import { PasswordField } from "@/components/password-field";
import { MIN_PASSWORD, PasswordRule } from "@/components/password-rule";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { hudMessage, problem, send } from "@/lib/api-errors";
import { enterWithSession } from "@/lib/session";

// The account's time zone is the phone's (booking reminders and the like are timed in it), with
// Cairo for the rare phone that doesn't say.
const timezone = () => getCalendars()[0]?.timeZone ?? "Africa/Cairo";

// Sign up, step 3: name and password, then the account is created and signed in. Creating the
// account is one of the app's big moments, so its button is lime. Numbers that already have an
// account were sent to "already registered" after the code; this still handles one registered in
// the meantime (on another device). An expired verification goes back to the phone.
export default function SignUpDetails() {
  const { t } = useTranslation();
  const { phone = "", token = "" } = useLocalSearchParams<{ phone: string; token: string }>();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const hud = useHud();

  const createAccount = async () => {
    setLoading(true);
    const result = await send(
      api.POST("/v1/auth/customer/sign-up", {
        body: { verificationToken: token, name: name.trim(), password, timezone: timezone() },
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
    // Busy until the next screen is showing, so the button doesn't flick back first.
    setLoading(true);
    await enterWithSession(result.data.session);
  };

  return (
    <Screen
      footer={
        <Button
          label={t("common.actions.createAccount")}
          variant="moment"
          disabled={!name.trim() || password.length < MIN_PASSWORD}
          loading={loading}
          onPress={() => void createAccount()}
        />
      }
    >
      <NavBar start={<BackButton onPress={() => router.back()} />} />
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
      <PasswordRule password={password} />
    </Screen>
  );
}
