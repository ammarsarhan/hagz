import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";

// Adding a venue, step 2 (Figma "Venue creation · 2 Name", 280:3): the name players already know,
// in whichever language the owner's app is in. The other language is written for them before the
// venue goes live, so there's no language switch here (docs/onboarding.md, decision 0).
//
// The limits are the API's (CreateVenue: 2 to 60 characters, trimmed), so a name it would refuse
// can't be typed rather than coming back as an error.
const MIN = 2;
const MAX = 60;

export default function CreateVenueName() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const typed = name.trim();

  return (
    <Screen
      footer={
        <Button
          label={t("common.actions.continue")}
          disabled={typed.length < MIN}
          onPress={() => router.push({ pathname: "/create-venue/place", params: { name: typed } })}
        />
      }
    >
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      <Title subtitle={t("screens.createVenue.name.subtitle")}>
        {t("screens.createVenue.name.title")}
      </Title>
      <Field
        label={t("screens.createVenue.name.label")}
        value={name}
        onChangeText={setName}
        maxLength={MAX}
        autoFocus
        autoCapitalize="words"
        returnKeyType="done"
      />
      {/* Under the field, on the end side: how much room is left, not an error. */}
      <View className="-mt-2 items-end">
        <Text className="text-caption text-ink-3">{`${name.length}/${MAX}`}</Text>
      </View>
    </Screen>
  );
}
