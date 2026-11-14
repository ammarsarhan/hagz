import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Switch, TextInput, View } from "react-native";
import type { components } from "@hagz/api";
import { AmenityIcon } from "@/components/amenity-icon";
import { Button } from "@/components/button";
import { FadingScroll } from "@/components/fading-scroll";
import { FieldBox, FieldLabel, inputClass } from "@/components/field";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { SetupLoading } from "@/components/setup-loading";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { queries, reference } from "@/lib/queries";
import { useSaveVenue, type VenueDetail } from "@/lib/venue-edit";

// Setup item "Amenities" (Figma "Amenities · A Priced = dashed border", 333:2, and its price sheet,
// 335:2): optional. Every option the marketplace offers is a pill; tapping one says the venue has
// it, free. Tapping it again opens its sheet, to charge for it (per hour or per booking) or take it
// off. A dashed border is an extra charge, so what's free and what isn't reads at a glance, with the
// key under the pills. Nothing is sent until Save, which sends the whole list (SetVenueAmenities).
type Amenity = components["schemas"]["Amenity"];
type Pricing = components["schemas"]["AmenityPricing"];
type Offered = { price: number | null; pricing: Pricing | null };

// How many decimals the currency's minor unit has (EGP 2, KWD 3), from the phone's own currency
// data; 2 if it doesn't know the code.
const decimalsOf = (currency: string) => {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
};

// 15000 → "150", 1550 → "15.5": no trailing zeros, since prices are mostly whole.
const amountOf = (minor: number, decimals: number) =>
  String(Number((minor / 10 ** decimals).toFixed(decimals)));

export default function SetupAmenities() {
  const { venueId = "" } = useLocalSearchParams<{ venueId: string }>();
  const venue = useQuery(queries.venue(venueId));
  const options = useQuery({
    ...reference.amenities(venue.data?.marketplace.code ?? ""),
    enabled: Boolean(venue.data),
  });
  if (!venue.data) return <SetupLoading query={venue} />;
  if (!options.data) return <SetupLoading query={options} />;
  return <AmenitiesForm venueId={venueId} venue={venue.data} options={options.data} />;
}

function AmenitiesForm({
  venueId,
  venue,
  options,
}: {
  venueId: string;
  venue: VenueDetail;
  options: Amenity[];
}) {
  const { t } = useTranslation();
  const { save, saving } = useSaveVenue(venueId);
  const currency = venue.marketplace.currency;
  const decimals = decimalsOf(currency);
  const [offered, setOffered] = useState<Map<string, Offered>>(
    () =>
      new Map(
        venue.amenities.map(({ optionId, price, pricing }) => [optionId, { price, pricing }]),
      ),
  );
  // The amenity whose sheet is up, kept while it slides away so its contents don't vanish first.
  const [editing, setEditing] = useState<Amenity | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const tap = (option: Amenity) => {
    if (!offered.has(option.id)) {
      setOffered(new Map(offered).set(option.id, { price: null, pricing: null }));
      return;
    }
    setEditing(option);
    setSheetOpen(true);
  };

  const priceLabel = ({ price, pricing }: Offered) =>
    price === null
      ? null
      : t(pricing === "PER_HOUR" ? "screens.setup.amenities.perHourPrice" : "screens.setup.amenities.perBookingPrice", { currency, amount: amountOf(price, decimals) }); // prettier-ignore

  const submit = () => {
    const amenities = [...offered].map(([optionId, { price, pricing }]) => ({
      optionId,
      price,
      pricing,
    }));
    const unchanged =
      amenities.length === venue.amenities.length &&
      venue.amenities.every((was) => {
        const now = offered.get(was.optionId);
        return now?.price === was.price && now.pricing === was.pricing;
      });
    if (unchanged) return router.back();
    void save([
      () =>
        send(
          api.PUT("/v1/staff/venues/{venueId}/amenities", {
            params: { path: { venueId } },
            body: { amenities },
          }),
        ),
    ]);
  };

  return (
    <Screen footer={<Button label={t("common.actions.save")} loading={saving} onPress={submit} />}>
      <NavBar
        flush
        start={<BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />}
      />
      <FadingScroll>
        <Title subtitle={t("screens.setup.amenities.subtitle")}>
          {t("screens.setup.items.AMENITIES.title")}
        </Title>
        <View className="flex-row flex-wrap gap-2.5">
          {options.map((option) => {
            const chosen = offered.get(option.id);
            return (
              <Pill
                key={option.id}
                option={option}
                chosen={chosen !== undefined}
                price={chosen ? priceLabel(chosen) : null}
                onPress={() => tap(option)}
              />
            );
          })}
        </View>
        {/* The key to the borders. */}
        <View className="mt-5 flex-row items-center gap-5">
          <View className="flex-row items-center gap-1.5">
            <View className="h-2.5 w-4 rounded-full border border-primary" />
            <Text className="text-caption text-ink-2">{t("screens.setup.amenities.free")}</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="h-2.5 w-4 rounded-full border border-dashed border-primary" />
            <Text className="text-caption text-ink-2">{t("screens.setup.amenities.extra")}</Text>
          </View>
        </View>
      </FadingScroll>

      {editing ? (
        <PriceSheet
          key={editing.id}
          visible={sheetOpen}
          amenity={editing}
          offered={offered.get(editing.id) ?? { price: null, pricing: null }}
          currency={currency}
          decimals={decimals}
          onClose={() => setSheetOpen(false)}
          onHidden={() => setEditing(null)}
          onSave={(next) => {
            setOffered(new Map(offered).set(editing.id, next));
            setSheetOpen(false);
          }}
          onRemove={() => {
            const next = new Map(offered);
            next.delete(editing.id);
            setOffered(next);
            setSheetOpen(false);
          }}
        />
      ) : null}
    </Screen>
  );
}

// Off: grey outline, ink. On and free: blue outline. On with a charge: dashed blue on a blue tint,
// with the price after the name.
function Pill({
  option,
  chosen,
  price,
  onPress,
}: {
  option: Amenity;
  chosen: boolean;
  price: string | null;
  onPress: () => void;
}) {
  const box = !chosen
    ? "border border-border bg-white"
    : price
      ? "border border-dashed border-primary bg-blue-tint"
      : "border border-primary bg-white";
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: chosen }}
      accessibilityLabel={price ? `${option.name}, ${price}` : option.name}
      onPress={onPress}
      className={`h-11 flex-row items-center gap-2 rounded-full px-3.5 active:opacity-70 ${box}`}
    >
      <AmenityIcon name={option.icon} size={20} color={chosen ? colors.primary : colors.ink} />
      <Text className={`text-body font-medium ${chosen ? "text-primary" : ""}`}>{option.name}</Text>
      {price ? <Text className="text-caption font-medium text-primary">{price}</Text> : null}
    </Pressable>
  );
}

function PriceSheet({
  visible,
  amenity,
  offered,
  currency,
  decimals,
  onClose,
  onHidden,
  onSave,
  onRemove,
}: {
  visible: boolean;
  amenity: Amenity;
  offered: Offered;
  currency: string;
  decimals: number;
  onClose: () => void;
  onHidden: () => void;
  onSave: (next: Offered) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [paid, setPaid] = useState(offered.price !== null);
  const [amount, setAmount] = useState(
    offered.price === null ? "" : amountOf(offered.price, decimals),
  );
  const [pricing, setPricing] = useState<Pricing>(offered.pricing ?? "PER_HOUR");
  const [focused, setFocused] = useState(false);
  const minor = Math.round(Number(amount) * 10 ** decimals);
  const valid = !paid || (Number.isFinite(minor) && minor >= 1);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onHidden={onHidden}
      closeLabel={t("components.shared.nav.close")}
    >
      <Text accessibilityRole="header" className="mb-4 text-[22px] font-semibold leading-[1.27]">
        {amenity.name}
      </Text>
      <View className="mb-5 flex-row items-center gap-4">
        <View className="flex-1">
          <Text className="text-subtitle font-medium">{t("screens.setup.amenities.paid")}</Text>
          <Text className="mt-0.5 text-label text-ink-2">
            {t("screens.setup.amenities.paidBody")}
          </Text>
        </View>
        <Switch
          value={paid}
          onValueChange={setPaid}
          trackColor={{ true: colors.primary, false: colors.border }}
          ios_backgroundColor={colors.border}
        />
      </View>

      {paid ? (
        <>
          <FieldLabel>{t("screens.setup.amenities.price")}</FieldLabel>
          <FieldBox focused={focused} error={false} ltr>
            <Text className="text-[17px] text-unit">{currency}</Text>
            <TextInput
              className={inputClass}
              value={amount}
              onChangeText={(text) => {
                // Digits and one decimal point, to the currency's precision.
                const cleaned = text.replace(/[^0-9.]/g, "");
                const [whole = "", fraction] = cleaned.split(".");
                setAmount(
                  fraction === undefined || decimals === 0
                    ? whole
                    : `${whole}.${fraction.slice(0, decimals)}`,
                );
              }}
              keyboardType={decimals > 0 ? "decimal-pad" : "number-pad"}
              placeholder="0"
              placeholderTextColor={colors.ink3}
              selectionColor={colors.primary}
              autoFocus={offered.price === null}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{ textAlign: "left", writingDirection: "ltr" }}
            />
          </FieldBox>
          {/* Per hour or per booking: two halves of one grey track, the chosen one raised. */}
          <View className="mt-3 flex-row rounded-[12px] bg-chip p-1">
            {(["PER_HOUR", "PER_BOOKING"] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected: pricing === option }}
                onPress={() => setPricing(option)}
                className={`h-10 flex-1 items-center justify-center rounded-[9px] ${pricing === option ? "bg-white" : ""}`}
              >
                <Text
                  className={`text-label font-medium ${pricing === option ? "" : "text-ink-2"}`}
                >
                  {t(
                    option === "PER_HOUR"
                      ? "screens.setup.amenities.perHour"
                      : "screens.setup.amenities.perBooking",
                  )}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <View className="mt-6 gap-1">
        <Button
          label={t("common.actions.save")}
          disabled={!valid}
          onPress={() => onSave(paid ? { price: minor, pricing } : { price: null, pricing: null })}
        />
        <Button
          label={t("screens.setup.amenities.remove", { amenity: amenity.name })}
          variant="ghost"
          onPress={onRemove}
        />
      </View>
    </Sheet>
  );
}
