import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/button";
import { CodeInput } from "@/components/code-input";
import { useHud } from "@/components/hud";
import { BackButton, NavBar } from "@/components/nav";
import { ResendCode } from "@/components/resend-code";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { fieldMessage, hudMessage, problem, send } from "@/lib/api-errors";
import { displayPhone, isolate, toE164 } from "@/lib/phone";

// Reset, step 3: the WhatsApp code, checked as soon as all six digits are in, before the new
// password is asked for. Owners get no code; the line under the boxes points them to support.
export default function ResetCode() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ phone: string; resendAfter: string }>();
  const phone = params.phone ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resend, setResend] = useState({ after: Number(params.resendAfter ?? 60), sentAt: 0 });
  const [resending, setResending] = useState(false);
  const hud = useHud();
  const masked = `${displayPhone(phone).slice(0, 7)} ••• ${phone.slice(-4)}`;

  const verify = async (value: string) => {
    setChecking(true);
    const result = await send(
      api.POST("/v1/auth/staff/password-resets/verify", {
        body: { phone: toE164(phone), code: value },
      }),
    );
    setChecking(false);
    if (!result.ok) {
      const failure = problem(result.error)?.code;
      if (failure === "INVALID_CODE" || failure === "CODE_EXPIRED") {
        setError(fieldMessage(result.error));
      } else if (failure === "RATE_LIMITED") {
        setLocked(true);
        setError(fieldMessage(result.error));
      } else {
        hud.show(hudMessage(result.error));
      }
      return;
    }
    router.push({
      pathname: "/forgot-password/new-password",
      params: { phone, resetToken: result.data.resetToken },
    });
  };

  // Check as soon as the sixth digit is typed or pasted: once per completed code, so this depends
  // on the code alone.
  useEffect(() => {
    if (code.length === 6 && !error && !locked) void verify(code);
  }, [code]);

  const resendCode = async () => {
    setResending(true);
    const result = await send(
      api.POST("/v1/auth/staff/password-resets", { body: { phone: toE164(phone) } }),
    );
    setResending(false);
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    setCode("");
    setError(undefined);
    setLocked(false);
    setResend({ after: result.data.resendAfter, sentAt: Date.now() });
  };

  return (
    <Screen
      footer={
        <Button
          label={t("common.actions.continue")}
          disabled={code.length < 6 || Boolean(error) || locked}
          loading={checking}
          onPress={() => void verify(code)}
        />
      }
    >
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      <Title subtitle={t("screens.forgotPassword.code.subtitle", { phone: isolate(masked) })}>
        {t("screens.forgotPassword.code.title")}
      </Title>
      <CodeInput
        value={code}
        onChangeText={(next) => {
          setCode(next);
          setError(undefined);
        }}
        error={error}
        disabled={locked}
      />
      <View className="mt-1 gap-3">
        <ResendCode
          key={resend.sentAt}
          resendAfter={resend.after}
          onResend={() => void resendCode()}
          sending={resending}
        />
        <Text className="text-label text-ink-2">
          {t("screens.forgotPassword.code.ownerHint")}{" "}
          <Text
            className="font-medium text-primary"
            onPress={() => router.push("/forgot-password/support")}
          >
            {t("screens.forgotPassword.code.ownerLink")}
          </Text>
        </Text>
      </View>
    </Screen>
  );
}
