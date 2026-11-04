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
import { queries } from "@/lib/queries";
import { queryClient } from "@/lib/query";

// Whether to skip "Resetting makes you view-only": only when we know the reset restricts nothing,
// i.e. signed in (Account → change password) and a member at no venue. Venues are only in the cache
// while signed in (signing out clears it); they're fetched again, as the cache may be from before
// joining a team. Signed out, or unsure, the warning shows: the API can't say before the code without
// telling anyone whether a number is on a team.
const restrictsNothing = async () => {
  if (queryClient.getQueryData(queries.venues.queryKey) === undefined) return false;
  try {
    const venues = await queryClient.fetchQuery({ ...queries.venues, staleTime: 0 });
    return !venues.some((venue) => venue.role === "MEMBER");
  } catch {
    return false;
  }
};

// Reset, step 1: the number (filled in from sign in when there was one). The API answers the same for every number; members get a code, owners
// get a WhatsApp message saying to reset with support, so the next steps are the same for everyone.
export default function ResetPhone() {
  const { t } = useTranslation();
  // Filled in with whatever was typed on sign in.
  const params = useLocalSearchParams<{ phone?: string }>();
  const [phone, setPhone] = useState(params.phone ?? "");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const hud = useHud();

  const sendCode = async () => {
    setLoading(true);
    const [result, skipWarning] = await Promise.all([
      send(api.POST("/v1/auth/staff/password-resets", { body: { phone: toE164(phone) } })),
      restrictsNothing(),
    ]);
    setLoading(false);
    if (!result.ok) {
      const failure = problem(result.error)?.code;
      if (failure === "INVALID_PHONE_NUMBER") setError(t("screens.signUp.phone.invalid"));
      else if (failure === "RATE_LIMITED") setError(fieldMessage(result.error));
      else hud.show(hudMessage(result.error));
      return;
    }
    router.push({
      pathname: skipWarning ? "/forgot-password/code" : "/forgot-password/warning",
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
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
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
