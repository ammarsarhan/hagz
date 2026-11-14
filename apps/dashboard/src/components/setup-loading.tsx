import type { UseQueryResult } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import { hudMessage } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { Button } from "./button";
import { useHud } from "./hud";
import { BackButton, NavBar } from "./nav";
import { Screen } from "./screen";

// A setup item's screen before the venue has loaded: back, and a spinner, or a retry button when it
// couldn't be read (the reason in the HUD). Usually skipped: the checklist already has the venue.
export function SetupLoading({ query }: { query: UseQueryResult<unknown> }) {
  const { t } = useTranslation();
  const hud = useHud();
  const failed = query.isError;
  useEffect(() => {
    if (failed) hud.show(hudMessage(query.error));
  }, [failed, query.error, hud]);

  return (
    <Screen
      footer={
        failed ? (
          <Button label={t("screens.firstRun.retry")} onPress={() => void query.refetch()} />
        ) : undefined
      }
    >
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      {failed ? null : (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.ink3} />
        </View>
      )}
    </Screen>
  );
}
