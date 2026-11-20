import { useTranslation } from "react-i18next";
import { TabPlaceholder } from "@/components/tab-placeholder";

export default function BookingsTab() {
  const { t } = useTranslation();
  return <TabPlaceholder title={t("screens.bookings.title")} line={t("screens.bookings.line")} />;
}
