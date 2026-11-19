import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Button } from "@/components/button";
import { useHud } from "@/components/hud";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { displayPhone } from "@/lib/phone";

// The number already has an account. Shown straight after its code is confirmed (so it reveals
// nothing to anyone who doesn't hold the number), instead of after a name and password.
export default function AlreadyRegistered() {
  // The token from confirming the sign-up code: it proves the number, so resetting the password
  // needs no second code. Missing when the number was registered between the code and the name
  // (on another device): then the reset starts from the number as usual.
  const { phone = "", token = "" } = useLocalSearchParams<{ phone: string; token: string }>();
  const [resetting, setResetting] = useState(false);
  const hud = useHud();

  const forgotPassword = async () => {
    if (!token) {
      router.push({ pathname: "/forgot-password", params: { phone } });
      return;
    }
    setResetting(true);
    const result = await send(
      api.POST("/v1/auth/customer/password-resets/verify", { body: { verificationToken: token } }),
    );
    setResetting(false);
    if (!result.ok) {
      // Used or expired: the usual reset, from the number.
      hud.show(hudMessage(result.error));
      router.push({ pathname: "/forgot-password", params: { phone } });
      return;
    }
    router.push({
      pathname: "/forgot-password/new-password",
      params: { phone, resetToken: result.data.resetToken },
    });
  };

  return (
    <Screen
      footer={
        <>
          <Button
            label="Sign in"
            onPress={() => router.replace({ pathname: "/sign-in", params: { phone } })}
          />
          <Button
            label="Forgot password?"
            variant="ghost"
            loading={resetting}
            onPress={() => void forgotPassword()}
          />
        </>
      }
    >
      <NavBar start={<BackButton onPress={() => router.back()} />} />
      <Title
        subtitle={
          <>
            <Text className="text-ink">{displayPhone(phone)}</Text> is already on Hagz. Sign in
            instead, or reset your password if you’ve forgotten it.
          </>
        }
      >
        You already have an account
      </Title>
    </Screen>
  );
}
