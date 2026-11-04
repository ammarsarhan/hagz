import { useTranslation } from "react-i18next";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";

// Placeholder until this tab's screens are built.
export default function VenuePayments() {
  const { t } = useTranslation();
  return (
    <Screen tabbed>
      <Title subtitle={t("screens.venueTabs.payments.subtitle")}>
        {t("screens.venueTabs.payments.title")}
      </Title>
    </Screen>
  );
}
