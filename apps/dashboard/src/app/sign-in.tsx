import { router } from "expo-router";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { t } from "@/lib/i18n";

// Placeholder until the sign in flow is built.
export default function Placeholder() {
  return (
    <Screen>
      <NavBar start={<BackButton label={t("back")} onPress={() => router.back()} />} />
      <Title subtitle={t("comingNext")}>{t("signIn")}</Title>
    </Screen>
  );
}
