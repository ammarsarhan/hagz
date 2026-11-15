import { useQueries, useQuery } from "@tanstack/react-query";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Button } from "@/components/button";
import { IconChevronRight } from "@/components/icons";
import { SetupLoading } from "@/components/setup-loading";
import { StepScreen } from "@/components/step-screen";
import { Text } from "@/components/text";
import { colors } from "@/lib/colors";
import type { Ground } from "@/lib/grounds";
import { weekFromApi, weekSummary } from "@/lib/hours";
import { isRTL } from "@/lib/language";
import { queries } from "@/lib/queries";

// Setup item "Opening hours": each ground has its own week, so with more than one ground this
// lists them, each with its week in a few words, and a tap opens that ground's week. With one
// ground there's nothing to choose, and it goes straight there. (Not in Figma; the user chose a
// list first, 2026-11-15.)
export default function SetupHours() {
  const { venueId = "" } = useLocalSearchParams<{ venueId: string }>();
  const grounds = useQuery(queries.grounds(venueId));
  if (!grounds.data) return <SetupLoading query={grounds} />;
  const [only] = grounds.data;
  if (grounds.data.length === 1 && only) {
    return <Redirect href={`/setup/${venueId}/hours/${only.id}`} />;
  }
  return <HoursList venueId={venueId} grounds={grounds.data} />;
}

function HoursList({ venueId, grounds }: { venueId: string; grounds: Ground[] }) {
  const { t } = useTranslation();
  const schedules = useQueries({
    queries: grounds.map((ground) => queries.schedule(venueId, ground.id)),
  });

  return (
    <StepScreen
      title={t("screens.setup.hours.title")}
      subtitle={t("screens.setup.hours.listSubtitle")}
      footer={<Button label={t("screens.setup.hours.done")} onPress={() => router.back()} />}
    >
      <View className="border-t border-border">
        {grounds.map((ground, index) => {
          const days = schedules[index]?.data;
          // The ground's count of open hours says whether it's set before its week has loaded.
          const summary =
            ground.openHours === 0
              ? t("screens.setup.hours.notSet")
              : days
                ? (weekSummary(t, weekFromApi(days)) ?? t("screens.setup.hours.notSet"))
                : " ";
          const name = ground.name ?? t("screens.setup.grounds.unnamed");
          return (
            <Pressable
              key={ground.id}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${summary}`}
              onPress={() => router.push(`/setup/${venueId}/hours/${ground.id}`)}
              className="flex-row items-center gap-3 border-b border-border py-[15px] active:opacity-60"
            >
              <View className="flex-1">
                <Text className="text-subtitle font-medium leading-[1.31]">{name}</Text>
                <Text
                  className={`mt-[3px] text-label leading-[1.43] ${ground.openHours === 0 ? "font-medium text-ink" : "text-ink-2"}`}
                >
                  {summary}
                </Text>
              </View>
              <IconChevronRight
                size={18}
                color={colors.ink3}
                style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
              />
            </Pressable>
          );
        })}
      </View>
    </StepScreen>
  );
}
