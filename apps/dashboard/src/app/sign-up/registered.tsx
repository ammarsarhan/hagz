import { router, useLocalSearchParams } from "expo-router";
import { Button } from "@/components/button";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { useTranslation } from "react-i18next";
import { displayPhone, isolate } from "@/lib/phone";

// The number already has an account. Shown straight after its code is confirmed (so it reveals
// nothing to anyone who doesn't hold the number), instead of after a name and password.
export default function AlreadyRegistered() {
  const { t } = useTranslation();
  // The token from confirming the sign-up code: it proves the number, so a reset needs no new code.
  const { phone = "", token = "" } = useLocalSearchParams<{ phone: string; token: string }>();
  return (
    <Screen
      footer={
        <>
          <Button label={t("common.actions.signIn")} onPress={() => router.replace("/sign-in")} />
          <Button
            label={t("common.actions.forgotPassword")}
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: "/forgot-password/warning",
                params: { phone, verificationToken: token },
              })
            }
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
