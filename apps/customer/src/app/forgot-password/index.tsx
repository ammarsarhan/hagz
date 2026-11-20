import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { useHud } from "@/components/hud";
import { BackButton, NavBar } from "@/components/nav";
import { PhoneField } from "@/components/phone-field";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { fieldMessage, hudMessage, problem, send } from "@/lib/api-errors";
import { isCompletePhone, toE164 } from "@/lib/phone";

// Reset, step 1: the number (filled in from sign in when there was one). The API answers the same
// for every number, so nobody can tell from here whether one has an account.
export default function ResetPhone() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ phone?: string }>();
  const [phone, setPhone] = useState(params.phone ?? "");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const hud = useHud();

  const sendCode = async () => {
    setLoading(true);
    const result = await send(
      api.POST("/v1/auth/customer/password-resets", { body: { phone: toE164(phone) } }),
    );
    setLoading(false);
    if (!result.ok) {
      const failure = problem(result.error)?.code;
      if (failure === "INVALID_PHONE_NUMBER" || failure === "RATE_LIMITED") {
        setError(fieldMessage(result.error));
      } else {
        hud.show(hudMessage(result.error));
      }
      return;
    }
    router.push({
      pathname: "/forgot-password/code",
      params: { phone, resendAfter: String(result.data.resendAfter) },
    });
  };

  return (
    <Screen
      footer={
        <Button
          label={t("common.actions.sendCode")}
          disabled={!isCompletePhone(phone)}
          loading={loading}
          onPress={() => void sendCode()}
        />
      }
    >
      <NavBar start={<BackButton onPress={() => router.back()} />} />
      <Title subtitle={t("screens.forgotPassword.phone.subtitle")}>
        {t("screens.forgotPassword.phone.title")}
      </Title>
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
