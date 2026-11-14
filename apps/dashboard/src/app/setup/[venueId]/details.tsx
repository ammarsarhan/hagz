import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";
import { FadingScroll } from "@/components/fading-scroll";
import { Field, TextArea } from "@/components/field";
import { BackButton, NavBar } from "@/components/nav";
import { PhoneField } from "@/components/phone-field";
import { Screen } from "@/components/screen";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { fieldMessage, problem, send } from "@/lib/api-errors";
import { language } from "@/lib/language";
import { queries } from "@/lib/queries";
import { useSaveVenue, type VenueDetail } from "@/lib/venue-edit";
import { SetupLoading } from "@/components/setup-loading";

// Setup item "Details" (Figma "Setup · Details (app language)", 325:2): what players read on the
// venue page — name, description, street address — and the number they can call. Written in the
// app's language only; Hagz writes the other before the venue goes live (docs/onboarding.md,
// decision 0), so there's no language switch.
//
// The limits are the API's (VenueTranslationInput, UpdateVenue), so nothing typed here is refused.
const NAME = { min: 2, max: 60 };
const DESCRIPTION_MAX = 600;
const ADDRESS_MAX = 200;
// The phone field takes the digits after +20; Hagz's only marketplace is Egypt for now.
const CALLING_CODE = "+20";
const APP_LANGUAGE = language === "ar" ? "AR" : "EN";

export default function SetupDetails() {
  const { venueId = "" } = useLocalSearchParams<{ venueId: string }>();
  const venue = useQuery(queries.venue(venueId));
  if (!venue.data) return <SetupLoading query={venue} />;
  return <DetailsForm venueId={venueId} venue={venue.data} />;
}

function DetailsForm({ venueId, venue }: { venueId: string; venue: VenueDetail }) {
  const { t } = useTranslation();
  const { save, saving } = useSaveVenue(venueId);
  // The app's language, or else whichever the venue was started in: its name carries over, and is
  // saved in the app's language from here.
  const start =
    venue.translations.find((translation) => translation.language === APP_LANGUAGE) ??
    venue.translations[0];
  const [name, setName] = useState(start?.name ?? "");
  const [description, setDescription] = useState(start?.description ?? "");
  const [address, setAddress] = useState(start?.address ?? "");
  const [phone, setPhone] = useState(
    venue.phone?.startsWith(CALLING_CODE) ? venue.phone.slice(CALLING_CODE.length) : "",
  );
  const [phoneError, setPhoneError] = useState<string>();

  const text = {
    name: name.trim(),
    description: description.trim() || null,
    address: address.trim() || null,
  };
  const translationChanged =
    start?.language !== APP_LANGUAGE ||
    text.name !== start.name ||
    text.description !== start.description ||
    text.address !== start.address;
  const nextPhone = phone ? `${CALLING_CODE}${phone}` : null;
  const phoneChanged = nextPhone !== venue.phone;

  const submit = () => {
    if (!translationChanged && !phoneChanged) return router.back();
    void save(
      [
        ...(translationChanged
          ? [
              () =>
                send(
                  api.PUT("/v1/staff/venues/{venueId}/translations/{language}", {
                    params: { path: { venueId, language: APP_LANGUAGE } },
                    body: text,
                  }),
                ),
            ]
          : []),
        ...(phoneChanged
          ? [
              () =>
                send(
                  api.PATCH("/v1/staff/venues/{venueId}", {
                    params: { path: { venueId } },
                    body: { phone: nextPhone },
                  }),
                ),
            ]
          : []),
      ],
      (error) => {
        // A number that isn't one is theirs to fix, under the field.
        if (problem(error)?.code !== "INVALID_PHONE_NUMBER") return false;
        setPhoneError(fieldMessage(error));
        return true;
      },
    );
  };

  return (
    <Screen
      footer={
        <Button
          label={t("common.actions.save")}
          disabled={text.name.length < NAME.min}
          loading={saving}
          onPress={submit}
        />
      }
    >
      <NavBar
        flush
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      <FadingScroll>
        <Title subtitle={t("screens.setup.details.subtitle")}>
          {t("screens.setup.items.DETAILS.title")}
        </Title>
        <Field
          label={t("screens.setup.details.name")}
          value={name}
          onChangeText={setName}
          maxLength={NAME.max}
          autoCapitalize="words"
        />
        <TextArea
          label={t("screens.setup.details.description")}
          value={description}
          onChangeText={setDescription}
          maxLength={DESCRIPTION_MAX}
          placeholder={t("screens.setup.details.descriptionPlaceholder")}
        />
        <Field
          label={t("screens.setup.details.address")}
          value={address}
          onChangeText={setAddress}
          maxLength={ADDRESS_MAX}
          placeholder={t("screens.setup.details.addressPlaceholder")}
        />
        <PhoneField
          label={t("screens.setup.details.phone")}
          value={phone}
          onChangeText={(digits) => {
            setPhone(digits);
            setPhoneError(undefined);
          }}
          error={phoneError}
        />
      </FadingScroll>
    </Screen>
  );
}
