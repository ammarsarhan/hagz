import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
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
import { useTranslation } from "react-i18next";
import { displayPhone, isolate, toE164 } from "@/lib/phone";

// Sign up, step 2: the 6-digit WhatsApp code. It's checked as soon as all six digits are in. Too
// many wrong tries lock the boxes; a new code can be asked for once the countdown runs out.
export default function SignUpCode() {
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

  const confirm = async (value: string) => {
    setChecking(true);
    const result = await send(
      api.POST("/v1/auth/staff/verifications/confirm", {
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
    // An existing account is only revealed now, to whoever holds the number: offer sign-in instead
    // of asking for a name and password.
    if (result.data.accountExists) {
      router.replace({ pathname: "/sign-up/registered", params: { phone } });
      return;
    }
    router.push({
      pathname: "/sign-up/details",
      params: { phone, token: result.data.verificationToken },
    });
  };

  // Check as soon as the sixth digit is typed or pasted: once per completed code, so this depends
  // on the code alone.
  useEffect(() => {
    if (code.length === 6 && !error && !locked) void confirm(code);
  }, [code]);

  const resendCode = async () => {
    setResending(true);
    const result = await send(
      api.POST("/v1/auth/staff/verifications", { body: { phone: toE164(phone) } }),
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
          onPress={() => void confirm(code)}
        />
      }
    >
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      <Title
        subtitle={
          <>
            {t("screens.signUp.code.sentTo", { phone: isolate(displayPhone(phone)) })}{" "}
            <Text className="font-medium text-primary" onPress={() => router.back()}>
              {t("common.actions.change")}
            </Text>
          </>
        }
      >
        {t("screens.signUp.code.title")}
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
      <View className="mt-1">
        <ResendCode
          key={resend.sentAt}
          resendAfter={resend.after}
          onResend={() => void resendCode()}
          sending={resending}
        />
      </View>
    </Screen>
  );
}
