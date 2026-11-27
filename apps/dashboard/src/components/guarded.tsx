import { router } from "expo-router";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { allows, usePermissions, type Rule } from "@/lib/access";
import { BackButton, NavBar } from "./nav";
import { Screen } from "./screen";
import { Text } from "./text";

// A screen only for members whose access allows it (lib/access.ts), checked before it mounts: none
// of its data is asked for and nothing of it shows first. Without it, a short page says so (reached
// from an old link, or access cut while it was open: the screen gives way at once). Blank while
// the venues are still being read.
export function guarded<P extends object>(
  rule: Rule,
  Inner: ComponentType<P>,
  { tabbed = false }: { tabbed?: boolean } = {},
) {
  function Guarded(props: P) {
    const { permissions, ready } = usePermissions();
    if (!ready) return <Screen tabbed={tabbed}>{null}</Screen>;
    if (!allows(permissions, rule)) return <NoAccess tabbed={tabbed} />;
    return <Inner {...props} />;
  }
  Guarded.displayName = `Guarded(${Inner.displayName ?? Inner.name})`;
  return Guarded;
}

function NoAccess({ tabbed }: { tabbed: boolean }) {
  const { t } = useTranslation();
  return (
    <Screen tabbed={tabbed}>
      {tabbed ? (
        <View className="h-10" />
      ) : (
        <NavBar
          start={
            <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
          }
        />
      )}
      <View className="flex-1 items-center justify-center pb-16">
        <Text accessibilityRole="header" className="text-center text-heading font-semibold">
          {t("components.noAccess.title")}
        </Text>
        <Text className="mt-2 text-center text-body text-ink-2" style={{ maxWidth: "85%" }}>
          {t("components.noAccess.body")}
        </Text>
      </View>
    </Screen>
  );
}
