import { router, useLocalSearchParams } from "expo-router";
import { Button } from "@/components/button";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { useTranslation } from "react-i18next";
import { displayPhone, isolate } from "@/lib/phone";

// The confirmed number already has an account. Shown only after the code is confirmed, so it
// doesn't reveal which numbers are registered.
export default function AlreadyRegistered() {
  const { t } = useTranslation();
  const { phone = "" } = useLocalSearchParams<{ phone: string }>();
  return (
    <Screen
      footer={
        <>
          <Button label={t("common.actions.signIn")} onPress={() => router.replace("/sign-in")} />
          <Button
            label={t("common.actions.forgotPassword")}
            variant="ghost"
            onPress={() => router.push("/forgot-password")}
          />
        </>
      }
    >
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      <Title
        subtitle={t("screens.signUp.registered.body", { phone: isolate(displayPhone(phone)) })}
      >
        {t("screens.signUp.registered.title")}
      </Title>
    </Screen>
  );
}
