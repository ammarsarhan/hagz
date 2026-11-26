import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Button } from "@/components/button";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { Field } from "@/components/field";
import { HoldFor, type HoldTarget } from "@/components/hold-for";
import { MoneyField } from "@/components/money-field";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { localDateOf } from "@/lib/calendar";
import { useCurrentVenue } from "@/lib/current-venue";
import { amountOf, cleanAmount, decimalsOf, minorOf } from "@/lib/money";
import { useNow } from "@/lib/use-now";
import { hoursSpan, relativeDay } from "@/lib/when";

// A new booking's price and note (Figma D10 614:2), right after its time: the time picked as a
// dashed card with Change (back to the picker), the price filled in from its slots and open to the
// venue's own, and an optional note. Continue asks who it's for (the hold's sheets, nothing held),
// then shows the booking in its day to add.

type Params = {
  slotId: string;
  groundId: string;
  startsAt: string;
  endsAt: string;
  price: string;
  currency: string;
  timezone: string;
  ground: string;
  kind: string;
};

export default function BookingDetails() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<Params>();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const compact = useCompactTitle();
  const now = useNow((at) => Math.floor(at / 60_000) * 60_000 + 60_000);
  const { timezone, currency } = params;
  const decimals = decimalsOf(currency);
  const slotsPrice = Number(params.price);
  const [price, setPrice] = useState(() => amountOf(slotsPrice, decimals));
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState<HoldTarget | null>(null);
  const total = minorOf(price, decimals);
  const ready = Number.isFinite(total) && total >= 0;

  const when = t("screens.hold.when", {
    day: relativeDay(localDateOf(params.startsAt, timezone), now, timezone, t),
    hours: hoursSpan(params.startsAt, params.endsAt, timezone, t),
    ground: params.ground,
  });
  const title = t("screens.book.title");

  return (
    <Screen
      footer={
        <Button
          label={t("screens.book.continue")}
          disabled={!ready}
          onPress={() =>
            setAsking({
              groundId: params.groundId,
              startsAt: params.startsAt,
              endsAt: params.endsAt,
            })
          }
        />
      }
    >
      <NavBar
        flush
        start={
          <CompactTitle
            button={
              <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
            }
            title={title}
            style={compact.style}
          />
        }
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Title
          small
          onTitleLayout={compact.onTitleLayout}
          subtitle={t("screens.book.detailsSubtitle")}
        >
          {title}
        </Title>

        {/* The time picked, with the way back to change it. */}
        <View className="mb-6 flex-row items-center rounded-xl border border-dashed border-primary bg-[#f2f4ff] px-4 py-3">
          <View className="flex-1">
            <Text className="text-body">
              {t("screens.book.time", {
                day: relativeDay(localDateOf(params.startsAt, timezone), now, timezone, t),
                hours: hoursSpan(params.startsAt, params.endsAt, timezone, t),
                ground: params.ground,
              })}
            </Text>
            {params.kind ? <Text className="text-caption text-ink-2">{params.kind}</Text> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            hitSlop={8}
            className="ms-3 active:opacity-70"
          >
            <Text className="text-body font-medium underline">{t("screens.book.change")}</Text>
          </Pressable>
        </View>

        <MoneyField
          label={t("screens.book.price")}
          currency={currency}
          decimals={decimals}
          value={price}
          onChangeText={(text) => setPrice(cleanAmount(text, decimals))}
          hint={t("screens.book.priceHint")}
        />
        <Field
          label={t("screens.book.note")}
          value={note}
          onChangeText={setNote}
          placeholder={t("screens.book.noteHint")}
          maxLength={500}
        />
      </FadingScroll>

      <HoldFor
        venueId={venueId}
        target={asking}
        when={when}
        holdMinutes={null}
        onClose={() => setAsking(null)}
        onWhoToCall={() => {
          setAsking(null);
          router.push({
            pathname: "/book/who-to-call",
            params: {
              slotId: params.slotId,
              startsAt: params.startsAt,
              endsAt: params.endsAt,
              ground: params.ground,
              timezone,
              currency,
              price: String(Number.isFinite(total) ? total : slotsPrice),
            },
          });
        }}
        onChoose={(choice) => {
          setAsking(null);
          router.push({
            pathname: "/book/confirm",
            params: {
              ...params,
              total: String(total),
              note: note.trim(),
              name: choice.name,
              customer: JSON.stringify(choice.customer),
            },
          });
        }}
      />
    </Screen>
  );
}
