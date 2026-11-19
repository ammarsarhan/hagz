import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Button } from "@/components/button";
import { useHud } from "@/components/hud";
import { BackButton, NavBar } from "@/components/nav";
import { PasswordField } from "@/components/password-field";
import { MIN_PASSWORD, PasswordRule } from "@/components/password-rule";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { api, auth } from "@/lib/api";
import { hudMessage, problem, send } from "@/lib/api-errors";
import { resetTo } from "@/lib/navigation";

// Reset, last step: the new password, with the reset token from the code (or from the sign-up
// verification). Setting it signs out every device; then back to sign in with the number filled in.
export default function ResetNewPassword() {
  const { phone = "", resetToken = "" } = useLocalSearchParams<{
    phone: string;
    resetToken: string;
  }>();
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const hud = useHud();

  const reset = async () => {
    setSaving(true);
    const result = await send(
      api.POST("/v1/auth/customer/password-resets/confirm", {
        body: { resetToken, newPassword: password },
      }),
    );
    setSaving(false);
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      // An expired reset starts over from the number.
      if (problem(result.error)?.code === "RESET_TOKEN_INVALID") {
        router.dismissTo({ pathname: "/forgot-password", params: { phone } });
      }
      return;
    }
    // Signed in on this phone (resetting from inside the app): the reset signed it out along with
    // every other, so it starts over at sign in, over Home, with nothing signed-in left to go back
    // to. The session is only forgotten here, not signed out: the server already ended it, and
    // asking again would answer SESSION_ENDED and navigate a second time, racing this one.
    if (await auth.isSignedIn()) {
      await auth.forget();
      resetTo("/home");
      router.push({ pathname: "/sign-in", params: { phone } });
      return;
    }
    router.dismissTo({ pathname: "/sign-in", params: { phone } });
  };

  return (
    <Screen
      footer={
        <Button
          label="Reset password"
          disabled={password.length < MIN_PASSWORD}
          loading={saving}
          onPress={() => void reset()}
        />
      }
    >
      <NavBar start={<BackButton onPress={() => router.back()} />} />
      <Title subtitle="You’ll use it to sign in. Every device signed in now will be signed out.">
        Choose a new password
      </Title>
      <PasswordField
        label="New password"
        value={password}
        onChangeText={setPassword}
        isNew
      />
      <PasswordRule password={password} />
    </Screen>
  );
}
