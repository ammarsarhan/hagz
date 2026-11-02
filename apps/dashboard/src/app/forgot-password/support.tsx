import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Linking } from "react-native";
import { Button } from "@/components/button";
import { InfoRows } from "@/components/info-rows";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";

// Owners reset through Hagz support. The reset request already sent them a WhatsApp message, so the
// next step is replying there.
export default function ResetWithSupport() {
  const { t } = useTranslation();
  return (
    <Screen
      footer={
        <>
          <Button
            label={t("screens.forgotPassword.support.openWhatsApp")}
            onPress={() => void Linking.openURL("whatsapp://")}
          />
          <Button
            label={t("screens.forgotPassword.support.backToSignIn")}
            variant="ghost"
            onPress={() => router.dismissTo("/sign-in")}
          />
        </>
      }
    >
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      <Title subtitle={t("screens.forgotPassword.support.subtitle")}>
        {t("screens.forgotPassword.support.title")}
      </Title>
      <InfoRows
        rows={[
          {
            title: t("screens.forgotPassword.support.whyTitle"),
            body: t("screens.forgotPassword.support.whyBody"),
          },
          {
            title: t("screens.forgotPassword.support.whatTitle"),
            body: t("screens.forgotPassword.support.whatBody"),
          },
        ]}
      />
    </Screen>
  );
}
