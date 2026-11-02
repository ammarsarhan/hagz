import { router } from "expo-router";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { useTranslation } from "react-i18next";

// Placeholder until the password reset flow is built.
export default function ForgotPassword() {
  const { t } = useTranslation();
  return (
    <Screen>
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      <Title subtitle={t("common.comingNext")}>{t("common.actions.forgotPassword")}</Title>
    </Screen>
  );
}
