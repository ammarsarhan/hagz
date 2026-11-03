import { router } from "expo-router";
import { useState } from "react";
import { Button } from "@/components/button";
import { useHud } from "@/components/hud";
import { BackButton, NavBar } from "@/components/nav";
import { PhoneField } from "@/components/phone-field";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { fieldMessage, hudMessage, problem, send } from "@/lib/api-errors";
import { useTranslation } from "react-i18next";
import { isCompletePhone, toE164 } from "@/lib/phone";

// Sign up, step 1: the mobile number. The API answers the same whether or not it has an account
// (no enumeration); an existing account only shows up after the code is confirmed.
export default function SignUpPhone() {
  const { t } = useTranslation();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const hud = useHud();

  const sendCode = async () => {
    setLoading(true);
    const result = await send(
      api.POST("/v1/auth/staff/verifications", { body: { phone: toE164(phone) } }),
    );
    setLoading(false);
    if (!result.ok) {
      const code = problem(result.error)?.code;
      if (code === "INVALID_PHONE_NUMBER") setError(t("screens.signUp.phone.invalid"));
      else if (code === "RATE_LIMITED") setError(fieldMessage(result.error));
      else hud.show(hudMessage(result.error));
      return;
    }
    router.push({
      pathname: "/sign-up/code",
      params: { phone, resendAfter: String(result.data.resendAfter) },
    });
  };

  return (
    <Screen
      footer={
        <>
          <Text className="mx-3 text-center text-caption text-ink-3">
            {t("screens.signUp.phone.terms")}
          </Text>
          <Button
            label={t("common.actions.sendCode")}
            disabled={!isCompletePhone(phone)}
            loading={loading}
            onPress={sendCode}
          />
        </>
      }
    >
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      <Title subtitle={t("screens.signUp.phone.subtitle")}>{t("screens.signUp.phone.title")}</Title>
      <PhoneField
        value={phone}
        onChangeText={(digits) => {
          setPhone(digits);
          setError(undefined);
        }}
        error={error}
      />
    </Screen>
  );
}
