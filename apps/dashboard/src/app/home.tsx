import { router } from "expo-router";
import { useState } from "react";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { auth } from "@/lib/api";
import { t } from "@/lib/i18n";

// Placeholder for where signing in lands until the first-run screen (D2) is built.
export default function Home() {
  const [signingOut, setSigningOut] = useState(false);
  return (
    <Screen
      footer={
        <Button
          label={t("signOut")}
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
      <Title subtitle={t("comingNext")}>{t("signedInTitle")}</Title>
    </Screen>
  );
}
