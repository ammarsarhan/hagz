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
import { isCompletePhone, toE164 } from "@/lib/phone";

// Sign up, step 1: the mobile number. The API answers the same whether or not it has an account
// (no enumeration); an existing account only shows up after the code is confirmed. Signing in is
// reached from here, for anyone who already has an account.
export default function SignUpPhone() {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const hud = useHud();

  const sendCode = async () => {
    setLoading(true);
    const result = await send(
      api.POST("/v1/auth/customer/verifications", { body: { phone: toE164(phone) } }),
    );
    setLoading(false);
    if (!result.ok) {
      const code = problem(result.error)?.code;
      if (code === "INVALID_PHONE_NUMBER" || code === "RATE_LIMITED") {
        setError(fieldMessage(result.error));
      } else {
        hud.show(hudMessage(result.error));
      }
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
          <Text className="pb-1 text-center text-body text-ink-2">
            Already have an account?{" "}
            <Text
              accessibilityRole="link"
              className="font-medium text-ink underline"
              onPress={() => router.push({ pathname: "/sign-in", params: { phone } })}
            >
              Sign in
            </Text>
          </Text>
          <Text className="mx-3 text-center text-caption text-unit">
            By continuing you agree to Hagz’s Terms and Privacy Policy.
          </Text>
          <Button
            label="Send code"
            disabled={!isCompletePhone(phone)}
            loading={loading}
            onPress={() => void sendCode()}
          />
        </>
      }
    >
      <NavBar start={<BackButton onPress={() => router.back()} />} />
      <Title subtitle="We’ll send a code on WhatsApp to confirm it’s yours.">
        What’s your mobile number?
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
