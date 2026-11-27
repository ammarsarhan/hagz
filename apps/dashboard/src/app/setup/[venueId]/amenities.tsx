import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Switch, TextInput, View } from "react-native";
import type { components } from "@hagz/api";
import { AmenityIcon } from "@/components/amenity-icon";
import { Button } from "@/components/button";
import { Collapse } from "@/components/collapse";
import { Segmented } from "@/components/choices";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { FieldBox, FieldLabel, inputClass } from "@/components/field";
import { IconTrash } from "@/components/icons";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { SetupLoading } from "@/components/setup-loading";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { amountOf, cleanAmount, decimalsOf } from "@/lib/money";
import { queries, reference } from "@/lib/queries";
import { useSaveVenue, type VenueDetail } from "@/lib/venue-edit";
import { guarded } from "@/components/guarded";
import { RULES } from "@/lib/access";

// Setup item "Amenities" (Figma "Amenities · A Priced = dashed border", 333:2, and its price sheet,
// 335:2): optional. Every option the marketplace offers is a pill; tapping one says the venue has
// it, free. Tapping it again opens its sheet, to charge for it (per hour or per booking) or take it
// off. A dashed border is an extra charge, so what's free and what isn't reads at a glance, with the
// key under the pills. Nothing is sent until Save, which sends the whole list (SetVenueAmenities).
type Amenity = components["schemas"]["Amenity"];
type Pricing = components["schemas"]["AmenityPricing"];
type Offered = { price: number | null; pricing: Pricing | null };

const PRICINGS = ["PER_HOUR", "PER_BOOKING"] as const;
type Charge = (typeof PRICINGS)[number];

function SetupAmenities() {
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
  const compact = useCompactTitle();
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

  // Nothing to save until the list differs from the venue's.
  const changed =
    offered.size !== venue.amenities.length ||
    venue.amenities.some((was) => {
      const now = offered.get(was.optionId);
      return now?.price !== was.price || now.pricing !== was.pricing;
    });

  const submit = () => {
    const amenities = [...offered].map(([optionId, { price, pricing }]) => ({
      optionId,
      price,
      pricing,
    }));
    // The layout's tray holds the venue's placeable amenities. One added only grows the tray, so
    // the layout is refetched. One taken off takes its tiles with it on the server, and the layout
    // editor starts from whatever is cached, so the cached layout is thrown away instead: the
    // editor would otherwise put the tiles back and the next save would be refused.
    const placeable = new Set(options.filter((o) => o.placeable).map((o) => o.id));
    const had = venue.amenities.filter((a) => placeable.has(a.optionId)).map((a) => a.optionId);
    const removed = had.some((id) => !offered.has(id));
    const added = [...offered.keys()].some((id) => placeable.has(id) && !had.includes(id));
    const layout = queries.layout(venueId).queryKey;
    void save(
      [
        () =>
          send(
            api.PUT("/v1/staff/venues/{venueId}/amenities", {
              params: { path: { venueId } },
              body: { amenities },
            }),
          ),
      ],
      undefined,
      removed ? { drop: [layout] } : added ? { also: [layout] } : {},
    );
  };

  return (
    <Screen
      footer={
        <Button
          label={t("common.actions.save")}
          disabled={!changed}
          loading={saving}
          onPress={submit}
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
            title={t("screens.setup.items.AMENITIES.title")}
            style={compact.style}
          />
        }
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Title
          subtitle={t("screens.setup.amenities.subtitle")}
          onTitleLayout={compact.onTitleLayout}
        >
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

// Off: grey outline, ink. On and free: blue outline. On with a charge: dashed blue on a blue tint.
// The price isn't written on the pill (the border says it costs extra; its sheet says how much), but
// screen readers still hear it.
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
  const [pricing, setPricing] = useState<Charge>(offered.pricing ?? "PER_HOUR");
  const [focused, setFocused] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const minor = Math.round(Number(amount) * 10 ** decimals);
  const valid = !paid || (Number.isFinite(minor) && minor >= 1);
  const changed = paid
    ? minor !== offered.price || pricing !== offered.pricing
    : offered.price !== null;

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
          onValueChange={(next) => {
            setPaid(next);
            // The fields open under the switch; typing the price is the next thing to do.
            if (next) input.current?.focus();
            else input.current?.blur();
          }}
          trackColor={{ true: colors.primary, false: colors.border }}
          ios_backgroundColor={colors.border}
        />
      </View>

      <Collapse open={paid}>
        <FieldLabel required>{t("screens.setup.amenities.price")}</FieldLabel>
        <FieldBox focused={focused} error={false} ltr>
          <Text className="text-[16px] text-unit">{currency}</Text>
          <TextInput
            className={inputClass}
            value={amount}
            onChangeText={(text) => setAmount(cleanAmount(text, decimals))}
            keyboardType={decimals > 0 ? "decimal-pad" : "number-pad"}
            placeholder="0"
            placeholderTextColor={colors.ink3}
            selectionColor={colors.primary}
            ref={input}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{ textAlign: "left", writingDirection: "ltr" }}
          />
        </FieldBox>
        {/* Per hour or per booking: the same sliding track as a ground's cover. */}
        <View className="mt-3">
          <Segmented
            options={PRICINGS}
            value={pricing}
            label={(option) =>
              t(
                option === "PER_HOUR"
                  ? "screens.setup.amenities.perHour"
                  : "screens.setup.amenities.perBooking",
              )
            }
            onChange={setPricing}
          />
        </View>
      </Collapse>

      {/* As in the photo sheet: take it off (grey, with a bin) beside saving. */}
      <View className="mt-6 flex-row gap-3">
        <View className="flex-1">
          <Button
            label={t("screens.setup.amenities.remove")}
            compact
            variant="secondary"
            icon={<IconTrash size={17} color={colors.ink} strokeWidth={2} />}
            onPress={onRemove}
          />
        </View>
        <View className="flex-1">
          <Button
            label={t("common.actions.save")}
            compact
            disabled={!valid || !changed}
            onPress={() =>
              onSave(paid ? { price: minor, pricing } : { price: null, pricing: null })
            }
          />
        </View>
      </View>
    </Sheet>
  );
}

export default guarded(RULES.venueForm, SetupAmenities);
