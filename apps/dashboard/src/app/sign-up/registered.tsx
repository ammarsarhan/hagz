import { router, useLocalSearchParams } from "expo-router";
import { Button } from "@/components/button";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { t } from "@/lib/i18n";
import { displayPhone, isolate } from "@/lib/phone";

// The confirmed number already has an account. Shown only after the code is confirmed, so it
// doesn't reveal which numbers are registered.
export default function AlreadyRegistered() {
  const { phone = "" } = useLocalSearchParams<{ phone: string }>();
  return (
    <Screen
      footer={
        <>
          <Button label={t("signIn")} onPress={() => router.replace("/sign-in")} />
          <Button
            label={t("forgotPassword")}
            variant="ghost"
            onPress={() => router.push("/forgot-password")}
          />
        </>
      }
    >
      <NavBar start={<BackButton label={t("back")} onPress={() => router.back()} />} />
      <Title subtitle={t("registeredBody", { phone: isolate(displayPhone(phone)) })}>
        {t("registeredTitle")}
      </Title>
    </Screen>
  );
}
