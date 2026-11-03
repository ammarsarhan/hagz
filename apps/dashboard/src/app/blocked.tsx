import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/button";
import { IconAlertCircle } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { colors } from "@/lib/colors";
import { contactSupport, hasSupport } from "@/lib/support";

// A suspended (temporary) or banned (permanent) account, after the right password: no way back
// in from here, only support. The one place with an icon above the title, in plain grey.
export default function Blocked() {
  const { t } = useTranslation();
  const { kind } = useLocalSearchParams<{ kind: "suspended" | "banned" }>();
  const copy = kind === "banned" ? "banned" : "suspended";

  return (
    <Screen
      footer={
        <>
          {hasSupport ? (
            <Button label={t("common.actions.contactSupport")} onPress={contactSupport} />
          ) : null}
          <Button
            label={t("common.actions.backToSignIn")}
            variant={hasSupport ? "ghost" : "secondary"}
            onPress={() => router.dismissTo("/sign-in")}
          />
        </>
      }
    >
      {/* No back button: the nav row's height keeps the title where it sits on other screens. */}
      <View className="mb-[22px] h-10 justify-end">
        <IconAlertCircle size={32} color={colors.unit} strokeWidth={1.75} />
      </View>
      <Title subtitle={t(`screens.blocked.${copy}.body`)}>
        {t(`screens.blocked.${copy}.title`)}
      </Title>
    </Screen>
  );
}
