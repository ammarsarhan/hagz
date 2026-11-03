import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";

// Placeholder: creating a venue is Phase 2.
export default function CreateVenue() {
  const { t } = useTranslation();
  return (
    <Screen>
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      <Title subtitle={t("common.comingNext")}>{t("screens.firstRun.createVenueTitle")}</Title>
    </Screen>
  );
}
