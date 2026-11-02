import type { components } from "@hagz/api";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "@/components/button";
import { CodeInput } from "@/components/code-input";
import { useHud } from "@/components/hud";
import { BackButton, NavBar } from "@/components/nav";
import { PasswordField } from "@/components/password-field";
import { PhoneField } from "@/components/phone-field";
import { ResendCode } from "@/components/resend-code";
import { Screen } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api, auth } from "@/lib/api";
import { fieldMessage, hudMessage, problem, send } from "@/lib/api-errors";
import { useTranslation } from "react-i18next";
import { displayPhone, isCompletePhone, isolate, toE164 } from "@/lib/phone";

type Challenge = components["schemas"]["TwoFactorChallenge"];

// Phone and password. With two-factor on, a right password opens a sheet for the WhatsApp code.
// A wrong number and a wrong password get the same message, so neither gives the other away.
export default function SignIn() {
  const { t } = useTranslation();
  // Filled in when arriving from a password reset.
  const params = useLocalSearchParams<{ phone?: string }>();
  const [phone, setPhone] = useState(params.phone ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const hud = useHud();

  const signIn = async () => {
    setLoading(true);
    const result = await send(
      api.POST("/v1/auth/staff/sessions", { body: { phone: toE164(phone), password } }),
    );
    setLoading(false);
    if (!result.ok) {
      const failure = problem(result.error)?.code;
      if (
        failure === "INVALID_CREDENTIALS" ||
        failure === "ACCOUNT_SUSPENDED" ||
        failure === "RATE_LIMITED"
      ) {
        setError(fieldMessage(result.error));
      } else {
        hud.show(hudMessage(result.error));
      }
      return;
    }
    if ("twoFactorRequired" in result.data) {
      setChallenge(result.data);
      return;
    }
    await auth.start(result.data.session);
    router.replace("/home");
  };

  return (
    <Screen
      footer={
        <Button
          label={t("common.actions.signIn")}
          disabled={!isCompletePhone(phone) || !password}
          loading={loading}
          onPress={() => void signIn()}
        />
      }
    >
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      <Title subtitle={t("screens.signIn.subtitle")}>{t("screens.signIn.title")}</Title>
      <PhoneField
        label={t("common.fields.mobileNumber")}
        value={phone}
        onChangeText={(digits) => {
          setPhone(digits);
          setError(undefined);
        }}
      />
      <PasswordField
        label={t("common.fields.password")}
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          setError(undefined);
        }}
        error={error}
      />
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push("/forgot-password")}
        hitSlop={8}
        className="self-start"
      >
        <Text className="text-body font-medium text-primary">
          {t("common.actions.forgotPassword")}
        </Text>
      </Pressable>

      {challenge ? (
        <TwoFactorSheet
          phone={phone}
          challenge={challenge}
          onChallenge={setChallenge}
          onClose={() => setChallenge(null)}
        />
      ) : null}
    </Screen>
  );
}

// The WhatsApp code that finishes a two-factor sign-in. Resending replaces the challenge token.
function TwoFactorSheet({
  phone,
  challenge,
  onChallenge,
  onClose,
}: {
  phone: string;
  challenge: Challenge;
  onChallenge: (next: Challenge) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [locked, setLocked] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const hud = useHud();
  // Only the last four digits, as in the Figma sheet: "+20 100 ••• 4567".
  const masked = `${displayPhone(phone).slice(0, 7)} ••• ${phone.slice(-4)}`;

  const verify = async () => {
    setVerifying(true);
    const result = await send(
      api.POST("/v1/auth/staff/sessions/two-factor", {
        body: { challengeToken: challenge.challengeToken, code },
      }),
    );
    setVerifying(false);
    if (!result.ok) {
      const failure = problem(result.error)?.code;
      if (failure === "INVALID_CODE" || failure === "CODE_EXPIRED") {
        setError(fieldMessage(result.error));
      } else if (failure === "RATE_LIMITED") {
        setLocked(true);
        setError(fieldMessage(result.error));
      } else {
        onClose();
        hud.show(hudMessage(result.error));
      }
      return;
    }
    await auth.start(result.data.session);
    router.replace("/home");
  };

  const resend = async () => {
    setResending(true);
    const result = await send(
      api.POST("/v1/auth/staff/sessions/two-factor/resend", {
        body: { challengeToken: challenge.challengeToken },
      }),
    );
    setResending(false);
    if (!result.ok) {
      if (problem(result.error)?.code === "CHALLENGE_EXPIRED") onClose();
      hud.show(hudMessage(result.error));
      return;
    }
    setCode("");
    setError(undefined);
    setLocked(false);
    onChallenge(result.data);
  };

  return (
    <Sheet visible onClose={onClose} closeLabel={t("components.shared.nav.close")}>
      <Text className="mb-1.5 text-heading font-semibold">
        {t("screens.signIn.twoFactor.title")}
      </Text>
      <Text className="mb-[22px] text-subtitle text-ink-2">
        {t("screens.signIn.twoFactor.subtitle", { phone: isolate(masked) })}
      </Text>
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
          key={challenge.challengeToken}
          resendAfter={challenge.resendAfter}
          onResend={() => void resend()}
          sending={resending}
        />
      </View>
      <View className="mt-[22px]">
        <Button
          label={t("common.actions.verify")}
          disabled={code.length < 6 || Boolean(error) || locked}
          loading={verifying}
          onPress={() => void verify()}
        />
      </View>
    </Sheet>
  );
}
