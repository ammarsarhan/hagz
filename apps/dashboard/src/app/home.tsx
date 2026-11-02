import { router } from "expo-router";
import { useState } from "react";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { auth } from "@/lib/api";
import { useTranslation } from "react-i18next";

// Placeholder for where signing in lands until the first-run screen (D2) is built.
export default function Home() {
  const { t } = useTranslation();
  const [signingOut, setSigningOut] = useState(false);
  return (
    <Screen
      footer={
        <Button
          label={t("common.actions.signOut")}
          variant="secondary"
          loading={signingOut}
          onPress={async () => {
            setSigningOut(true);
            await auth.signOut();
            router.replace("/");
          }}
        />
      }
    >
      <Title subtitle={t("common.comingNext")}>{t("screens.home.title")}</Title>
    </Screen>
  );
}
