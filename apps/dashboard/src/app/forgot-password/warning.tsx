import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { useHud } from "@/components/hud";
import { InfoRows } from "@/components/info-rows";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { hudMessage, problem, send } from "@/lib/api-errors";

// Reset, step 2: what a reset does to a member, before the new password is set (that's when it
// happens). Arriving from sign-up with the number already verified, Continue skips the code: the
// verification is exchanged for a reset straight away, and owners are sent to support.
export default function ResetWarning() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    phone: string;
    resendAfter?: string;
    verificationToken?: string;
  }>();
  const [loading, setLoading] = useState(false);
  const hud = useHud();

  const next = async () => {
    if (!params.verificationToken) {
      router.push({
        pathname: "/forgot-password/code",
        params: { phone: params.phone, resendAfter: params.resendAfter ?? "60" },
      });
      return;
    }
    setLoading(true);
    const result = await send(
      api.POST("/v1/auth/staff/password-resets/verify", {
        body: { verificationToken: params.verificationToken },
      }),
    );
    setLoading(false);
    if (!result.ok) {
      if (problem(result.error)?.code === "PASSWORD_RESET_THROUGH_SUPPORT") {
        router.replace("/forgot-password/support");
      } else {
        hud.show(hudMessage(result.error));
      }
      return;
    }
    router.replace({
      pathname: "/forgot-password/new-password",
      params: { phone: params.phone, resetToken: result.data.resetToken },
    });
  };

  return (
    <Screen
      footer={
        <>
          <Button
            label={t("common.actions.continue")}
            loading={loading}
            onPress={() => void next()}
          />
          <Button
            label={t("screens.forgotPassword.warning.cancel")}
            variant="ghost"
            onPress={() => router.dismissTo("/sign-in")}
          />
        </>
      }
    >
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      <Title subtitle={t("screens.forgotPassword.warning.subtitle")}>
        {t("screens.forgotPassword.warning.title")}
      </Title>
      <InfoRows
        rows={[
          {
            title: t("screens.forgotPassword.warning.canView"),
            body: t("screens.forgotPassword.warning.canViewBody"),
          },
          {
            title: t("screens.forgotPassword.warning.cantChange"),
            body: t("screens.forgotPassword.warning.cantChangeBody"),
          },
          {
            title: t("screens.forgotPassword.warning.ownersTold"),
            body: t("screens.forgotPassword.warning.ownersToldBody"),
          },
        ]}
      />
    </Screen>
  );
}
