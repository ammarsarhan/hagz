import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { SetupLoading } from "@/components/setup-loading";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { queries } from "@/lib/queries";
import { useSaveVenue, type VenueDetail } from "@/lib/venue-edit";

// Setup item "Tax number" (Figma "Setup · Tax number", 433:86): optional, only for venues that charge
// VAT. Digits and dashes, 5 to 20 of them (UpdateVenue), so Save waits for one the API takes. Clearing
// the field and saving removes it.
const TAX_NUMBER = /^[0-9-]{5,20}$/;
const MAX = 20;

export default function SetupTaxNumber() {
  const { venueId = "" } = useLocalSearchParams<{ venueId: string }>();
  const venue = useQuery(queries.venue(venueId));
  if (!venue.data) return <SetupLoading query={venue} />;
  return <TaxForm venueId={venueId} venue={venue.data} />;
}

function TaxForm({ venueId, venue }: { venueId: string; venue: VenueDetail }) {
  const { t } = useTranslation();
  const { save, saving } = useSaveVenue(venueId);
  const [value, setValue] = useState(venue.taxNumber ?? "");
  const typed = value.trim();
  const next = typed || null;

  const submit = () => {
    if (next === venue.taxNumber) return router.back();
    void save([
      () =>
        send(
          api.PATCH("/v1/staff/venues/{venueId}", {
            params: { path: { venueId } },
            body: { taxNumber: next },
          }),
        ),
    ]);
  };

  return (
    <Screen
      footer={
        <Button
          label={t("common.actions.save")}
          disabled={next !== null && !TAX_NUMBER.test(next)}
          loading={saving}
          onPress={submit}
        />
      }
    >
      <NavBar
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      <Title subtitle={t("screens.setup.tax.subtitle")}>
        {t("screens.setup.items.TAX_NUMBER.title")}
      </Title>
      <Field
        label={t("screens.setup.tax.label")}
        value={value}
        // Only what the API takes can be typed.
        onChangeText={(text) => setValue(text.replace(/[^0-9-]/g, ""))}
        maxLength={MAX}
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
        placeholder="123-456-789"
        returnKeyType="done"
        autoFocus={!venue.taxNumber}
      />
      <View className="-mt-2 items-end">
        <Text className="text-caption text-ink-3">{t("screens.setup.tax.hint")}</Text>
      </View>
    </Screen>
  );
}
