import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import { CREATE_VENUE_ART, CREATE_VENUE_ART_SIZE } from "@/assets/create-venue-art";
import { Button } from "@/components/button";
import { CloseButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";

// Adding a venue, step 1 of the flow (Figma "Start · B Hero scene", 307:2): the scene and one line on
// what's ahead, so nobody starts thinking it's a form and finds a week of setup. Closing goes back
// to where it started (first run, or Account › Venues later).
//
// The whole flow is its own stack outside the venue tabs: a draft has nothing to run yet, so it
// never appears in the dashboard (docs/flows.md, "draft venues").

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
    </Screen>
  );
}
