import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { InfoRows } from "@/components/info-rows";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";

// Reset, step 2: what a reset does to a member, before the new password is set (that's when it
// happens). The code is on its way meanwhile.
export default function ResetWarning() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ phone: string; resendAfter: string }>();
  return (
    <Screen
      footer={
        <>
          <Button
            label={t("common.actions.continue")}
            onPress={() => router.push({ pathname: "/forgot-password/new-password", params })}
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
