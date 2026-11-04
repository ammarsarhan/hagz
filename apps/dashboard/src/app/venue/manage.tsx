import { useTranslation } from "react-i18next";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";

// Placeholder until this tab's screens are built.
export default function VenueManage() {
  const { t } = useTranslation();
  return (
    <Screen tabbed>
      <Title subtitle={t("screens.venueTabs.manage.subtitle")}>
        {t("screens.venueTabs.manage.title")}
      </Title>
    </Screen>
  );
}
