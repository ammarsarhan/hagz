import { useTranslation } from "react-i18next";
import { TabPlaceholder } from "@/components/tab-placeholder";

export default function CommunityTab() {
  const { t } = useTranslation();
  return <TabPlaceholder title={t("screens.community.title")} line={t("screens.community.line")} />;
}
