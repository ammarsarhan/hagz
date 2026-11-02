import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { Button } from "@/components/button";
import { CodeInput } from "@/components/code-input";
import { FieldLabel } from "@/components/field";
import { useHud } from "@/components/hud";
import { IconCircleCheck } from "@/components/icons";
import { BackButton, NavBar } from "@/components/nav";
import { PasswordField } from "@/components/password-field";
import { ResendCode } from "@/components/resend-code";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { fieldMessage, hudMessage, problem, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { displayPhone, isolate, toE164 } from "@/lib/phone";

const MIN_PASSWORD = 8;

// Reset, step 3: the WhatsApp code and the new password together, as the API takes them. Setting it
// signs out every device. Owners get no code; the line under the boxes points them to support.
export default function ResetNewPassword() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ phone: string; resendAfter: string }>();
  const phone = params.phone ?? "";
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [resend, setResend] = useState({ after: Number(params.resendAfter ?? 60), sentAt: 0 });
  const [resending, setResending] = useState(false);
  const hud = useHud();
  const longEnough = password.length >= MIN_PASSWORD;
  const masked = `${displayPhone(phone).slice(0, 7)} ••• ${phone.slice(-4)}`;

  const reset = async () => {
    setSaving(true);
    const result = await send(
      api.POST("/v1/auth/staff/password-resets/confirm", {
        body: { phone: toE164(phone), code, newPassword: password },
      }),
    );
    setSaving(false);
    if (!result.ok) {
      const failure = problem(result.error)?.code;
      if (failure === "INVALID_CODE" || failure === "CODE_EXPIRED") {
        setCodeError(fieldMessage(result.error));
      } else if (failure === "RATE_LIMITED") {
        setLocked(true);
        setCodeError(fieldMessage(result.error));
      } else {
        hud.show(hudMessage(result.error));
      }
      return;
    }
    // Back to sign in with the number filled in, to sign in with the new password.
    router.dismissTo({ pathname: "/sign-in", params: { phone } });
  };

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
    setCodeError(undefined);
    setLocked(false);
    setResend({ after: result.data.resendAfter, sentAt: Date.now() });
  };

  return (
    <Screen
      footer={
        <Button
          label={t("screens.forgotPassword.newPassword.submit")}
          disabled={code.length < 6 || Boolean(codeError) || locked || !longEnough}
          loading={saving}
          onPress={() => void reset()}
        />
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <NavBar
          start={
            <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
          }
        />
        <Title
          subtitle={t("screens.forgotPassword.newPassword.subtitle", { phone: isolate(masked) })}
        >
          {t("screens.forgotPassword.newPassword.title")}
        </Title>

        <FieldLabel>{t("screens.forgotPassword.newPassword.code")}</FieldLabel>
        <CodeInput
          value={code}
          onChangeText={(next) => {
            setCode(next);
            setCodeError(undefined);
          }}
          error={codeError}
          disabled={locked}
        />
        <View className="mb-6 gap-2">
          <ResendCode
            key={resend.sentAt}
            resendAfter={resend.after}
            onResend={() => void resendCode()}
            sending={resending}
          />
          <Text className="text-label text-ink-2">
            {t("screens.forgotPassword.newPassword.ownerHint")}{" "}
            <Text
              className="font-medium text-primary"
              onPress={() => router.push("/forgot-password/support")}
            >
              {t("screens.forgotPassword.newPassword.ownerLink")}
            </Text>
          </Text>
        </View>

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
      </ScrollView>
    </Screen>
  );
}
