import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import { CREATE_VENUE_ART, CREATE_VENUE_ART_SIZE } from "@/assets/create-venue-art";
import { Button } from "@/components/button";
import { CloseButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";

// Adding a venue, step 1 of the flow (Figma "Start · B Hero scene, steps as text", 307:2): what the
// three steps are and roughly how long they take, so nobody starts thinking it's a form and finds a
// week of setup. Closing goes back to where it started (first run, or Account › Venues later).
//
// The whole flow is its own stack outside the venue tabs: a draft has nothing to run yet, so it
// never appears in the dashboard (docs/flows.md, "draft venues").
const STEPS = ["place", "setup", "review"] as const;

export default function CreateVenueStart() {
  const { t } = useTranslation();
  return (
    <Screen
      footer={
        <Button
          label={t("screens.createVenue.start.action")}
          onPress={() => router.push("/create-venue/name")}
        />
      }
    >
      <NavBar
        start={
          <CloseButton
            label={t("components.shared.nav.close")}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
          />
        }
      />
      <View
        className="mb-[18px] w-full"
        style={{ aspectRatio: CREATE_VENUE_ART_SIZE.width / CREATE_VENUE_ART_SIZE.height }}
      >
        <SvgXml xml={CREATE_VENUE_ART} width="100%" height="100%" />
      </View>
      <Title subtitle={t("screens.createVenue.start.subtitle")}>
        {t("screens.createVenue.start.title")}
      </Title>
      <View className="gap-[22px]">
        {STEPS.map((step, index) => (
          <View key={step}>
            <Text className="mb-[3px] text-caption font-medium text-primary-soft">
              {t("screens.createVenue.start.step", { number: index + 1 })}
            </Text>
            <Text className="text-subtitle font-medium leading-[1.3]">
              {t(`screens.createVenue.start.steps.${step}.title`)}
            </Text>
            <Text className="mt-[3px] text-label text-ink-2 leading-[1.43]">
              {t(`screens.createVenue.start.steps.${step}.body`)}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
