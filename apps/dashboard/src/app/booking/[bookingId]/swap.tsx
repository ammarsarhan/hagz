import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { components } from "@hagz/api";
import { BarButton, BottomBar } from "@/components/bottom-bar";
import { Button } from "@/components/button";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { DayPickHeader, HourColumn, LiftedCard, useLiftedCard } from "@/components/day-pick";
import { FadingScroll } from "@/components/fading-scroll";
import { Field } from "@/components/field";
import { useHud } from "@/components/hud";
import { IconArrowsExchange } from "@/components/icons";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { SetupLoading } from "@/components/setup-loading";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { localDateOf, weekStartOf } from "@/lib/calendar";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { decimalsOf, formatAmount } from "@/lib/money";
import { useNow } from "@/lib/use-now";
import { weekBookings, weekSlots } from "@/lib/week-queries";
import { hoursSpan } from "@/lib/when";
import { bookingQuery } from "./index";

// Swapping two bookings (Figma D9: pick 598:99, preview 598:199): the two trade times, each taking
// the other's exact hours and ground, in one step (the API's swap). Picking: the day's bookings
// that can still move, each with ⇄, the booking's own time dashed grey, and the booking lifted at
// the bottom with Cancel. Tapping one previews the trade on the day: the two rows in each other's
// places, each with its new price against the old, a blue two-way arrow between them, the rest
// faded; and a bar to Swap, with an optional note for both players. Back goes back to picking.

type Booking = components["schemas"]["StaffBookingDetail"];
type StaffBooking = components["schemas"]["StaffBooking"];

// Bookings still to be played (the API's MOVABLE), not staff holds, can trade places.
const MOVABLE = ["PENDING", "HELD", "UNCONFIRMED", "CONFIRMED"];

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export default function SwapBooking() {
  const { bookingId = "" } = useLocalSearchParams<{ bookingId: string }>();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const booking = useQuery(bookingQuery(venueId, bookingId));
  if (!booking.data) return <SetupLoading query={booking} />;
  return <Swapper booking={booking.data} venueId={venueId} />;
}

function Swapper({ booking, venueId }: { booking: Booking; venueId: string }) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const compact = useCompactTitle();
  const card = useLiftedCard();
  const now = useNow((at) => Math.floor(at / 60_000) * 60_000 + 60_000);
  const { timezone, currency } = booking;
  const money = (minor: number) => `${formatAmount(minor, decimalsOf(currency))} ${currency}`;
  const span = (from: string, to: string) => hoursSpan(from, to, timezone, t);
  const name = firstName(booking.customer.name);

  const [day, setDay] = useState(() => localDateOf(booking.startsAt, timezone));
  const weekStart = weekStartOf(day);
  const slots = useQuery(weekSlots(venueId, weekStart, venueId !== ""));
  const others = useQuery(weekBookings(venueId, weekStart, venueId !== ""));

  // The booking it trades with, once tapped; the note for both; the rows' places, for the arrow.
  const [partner, setPartner] = useState<StaffBooking | null>(null);
  const [note, setNote] = useState("");
  const [noting, setNoting] = useState(false);
  const [sending, setSending] = useState(false);
  const [places, setPlaces] = useState<Record<string, { y: number; height: number }>>({});

  const grounds = slots.data?.grounds ?? [];
  const groundName = (id: string) => grounds.find((ground) => ground.id === id)?.name ?? "";
  const onDay = (at: string) => localDateOf(at, timezone) === day;

  // A booking's hours at their slots' prices now: what the other pays for them after the trade.
  const slotPrice = (id: string) =>
    (slots.data?.slots ?? [])
      .filter((slot) => slot.bookingId === id)
      .reduce((sum, slot) => sum + slot.price, 0);
  const ownPrice =
    slotPrice(booking.id) ||
    booking.charges
      .filter((charge) => charge.type === "SLOT")
      .reduce((sum, charge) => sum + charge.amount, 0);

  const kindOf = (other: StaffBooking) =>
    other.regular
      ? t("screens.swap.weekly")
      : other.source === "APP"
        ? t("screens.swap.app")
        : t("screens.swap.walkIn");
  const barOf = (other: StaffBooking) =>
    other.status === "CONFIRMED" ? "bg-primary" : "bg-[#c9d6ff]";

  // Every booking this week it can trade with, on any ground (user: no ground picker here); the
  // picked day's are listed, and each day with any gets a dot.
  const swappable = (others.data ?? []).filter(
    (other) =>
      other.id !== booking.id &&
      MOVABLE.includes(other.status) &&
      !other.hold &&
      Date.parse(other.startsAt) > now,
  );
  const dots = new Set(swappable.map((other) => localDateOf(other.startsAt, timezone)));
  const candidates = swappable
    .filter((other) => onDay(other.startsAt))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "slots"] }),
      // A regular's week keeps its regular: its page shows where it went.
      queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "regulars"] }),
    ]);

  const swap = async () => {
    if (!partner) return;
    setSending(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/bookings/{bookingId}/swap", {
        params: { path: { venueId, bookingId: booking.id } },
        body: { withBookingId: partner.id, ...(note.trim() ? { reason: note.trim() } : {}) },
      }),
    );
    void refresh();
    // On success it keeps spinning until the booking's page takes over.
    if (!result.ok) {
      setSending(false);
      hud.show(hudMessage(result.error));
      return;
    }
    // This booking's new one comes first.
    const [mine] = result.data.data;
    router.dismiss();
    if (mine) router.replace(`/booking/${mine.id}`);
  };

  const back = () => {
    if (partner) {
      setPartner(null);
      setNote("");
    } else router.back();
  };

  const title = t("screens.swap.title", { name });
  const other = partner ? firstName(partner.customer.name) : "";
  const place =
    (key: string) => (event: { nativeEvent: { layout: { y: number; height: number } } }) => {
      const { y, height } = event.nativeEvent.layout;
      setPlaces((now) =>
        now[key]?.y === y && now[key].height === height ? now : { ...now, [key]: { y, height } },
      );
    };

  return (
    <Screen
      footer={
        partner ? (
          <BottomBar
            title={t("screens.swap.barTitle", { name, other })}
            detail={
              // A Pressable, not a pressable Text, which iOS greys while pressed.
              <Pressable
                accessibilityRole="button"
                onPress={() => setNoting(true)}
                hitSlop={8}
                className="self-start active:opacity-70"
              >
                <Text className="text-caption text-ink-2 underline">
                  {t(note.trim() ? "screens.swap.editNote" : "screens.swap.addNote")}
                </Text>
              </Pressable>
            }
          >
            <BarButton
              label={t("screens.swap.swap")}
              primary
              busy={sending}
              onPress={() => void swap()}
            />
          </BottomBar>
        ) : undefined
      }
    >
      <NavBar
        flush
        start={
          <CompactTitle
            button={<BackButton label={t("components.shared.nav.back")} onPress={back} />}
            title={title}
            style={compact.style}
          />
        }
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Title
          small
          onTitleLayout={compact.onTitleLayout}
          subtitle={
            partner
              ? t("screens.swap.previewSubtitle", { name, other })
              : t("screens.swap.subtitle", { name })
          }
        >
          {title}
        </Title>
        <DayPickHeader
          weekStart={weekStart}
          day={day}
          today={localDateOf(now, timezone)}
          onDay={(date) => {
            setPartner(null);
            setDay(date);
          }}
          dots={dots}
        />

        {!others.data ? (
          <ActivityIndicator className="mt-8" color={colors.ink3} />
        ) : partner ? (
          <Preview
            booking={booking}
            partner={partner}
            others={others.data}
            onDay={onDay}
            places={places}
            place={place}
            timezone={timezone}
            groundName={groundName}
            ownPrice={ownPrice}
            partnerPrice={slotPrice(partner.id) || partner.total}
            money={money}
            kindOf={kindOf}
            barOf={barOf}
          />
        ) : (
          <View className="gap-3 pt-5" style={{ paddingBottom: card.room }}>
            {onDay(booking.startsAt) ? (
              <View className="flex-row items-center">
                <HourColumn from={booking.startsAt} to={booking.endsAt} timezone={timezone} faded />
                <View className="ms-3 h-12 flex-1 justify-center rounded-xl border border-dashed border-ink-3 px-4">
                  <Text className="text-body text-ink-3">
                    {t("screens.move.yourTime", { name, ground: booking.ground.name ?? "" })}
                  </Text>
                </View>
              </View>
            ) : null}
            {candidates.length === 0 ? (
              <Text className="text-body text-ink-2" style={{ maxWidth: "75%" }}>
                {t("screens.swap.none")}
              </Text>
            ) : null}
            {candidates.map((candidate) => (
              <Pressable
                key={candidate.id}
                accessibilityRole="button"
                accessibilityLabel={t("screens.swap.withLabel", {
                  name: candidate.customer.name,
                  hours: span(candidate.startsAt, candidate.endsAt),
                })}
                onPress={() => setPartner(candidate)}
                className="flex-row items-center active:opacity-70"
              >
                <HourColumn from={candidate.startsAt} to={candidate.endsAt} timezone={timezone} />
                <View className={`ms-3 w-1 self-stretch rounded-full ${barOf(candidate)}`} />
                <View className="ms-4 flex-1 py-1">
                  <Text className="text-subtitle">{candidate.customer.name}</Text>
                  <Text className="text-label text-ink-2">
                    {t("screens.swap.detail", {
                      ground: candidate.ground.name ?? "",
                      kind: kindOf(candidate),
                      price: money(candidate.total),
                    })}
                  </Text>
                </View>
                <IconArrowsExchange size={20} color={colors.ink} strokeWidth={1.75} />
              </Pressable>
            ))}
          </View>
        )}
      </FadingScroll>

      {partner ? null : (
        <LiftedCard
          title={booking.customer.name}
          detail={t("screens.move.card", {
            hours: span(booking.startsAt, booking.endsAt),
            ground: booking.ground.name ?? "",
            price: money(ownPrice),
          })}
          bottom={card.bottom}
          onLayout={card.onLayout}
          onCancel={() => router.back()}
        />
      )}

      <Sheet
        visible={noting}
        onClose={() => setNoting(false)}
        closeLabel={t("components.shared.nav.close")}
      >
        <Text accessibilityRole="header" className="text-[22px] font-semibold leading-[1.27]">
          {t("screens.swap.noteTitle")}
        </Text>
        <Text className="mt-1.5 mb-6 text-body text-ink-2">
          {t("screens.swap.noteBody", { name, other })}
        </Text>
        <View className="mb-2">
          <Field
            label={t("screens.swap.noteLabel")}
            value={note}
            onChangeText={setNote}
            placeholder={t("screens.swap.noteHint")}
            maxLength={500}
          />
        </View>
        <Button label={t("screens.swap.done")} onPress={() => setNoting(false)} />
      </Sheet>
    </Screen>
  );
}

// The trade on the day: the two in each other's places, the rest faded, an arrow between them.
function Preview({
  booking,
  partner,
  others,
  onDay,
  places,
  place,
  timezone,
  groundName,
  ownPrice,
  partnerPrice,
  money,
  kindOf,
  barOf,
}: {
  booking: Booking;
  partner: StaffBooking;
  others: StaffBooking[];
  onDay: (at: string) => boolean;
  places: Record<string, { y: number; height: number }>;
  place: (
    key: string,
  ) => (event: { nativeEvent: { layout: { y: number; height: number } } }) => void;
  timezone: string;
  groundName: (id: string) => string;
  ownPrice: number;
  partnerPrice: number;
  money: (minor: number) => string;
  kindOf: (other: StaffBooking) => string;
  barOf: (other: StaffBooking) => string;
}) {
  const { t } = useTranslation();
  const grounds = new Set([booking.ground.id, partner.ground.id]);
  const priced = (price: number, was: number) =>
    price === was
      ? money(price)
      : t("screens.swap.priceWas", { price: money(price), was: money(was) });

  type Row = {
    key: string;
    startsAt: string;
    endsAt: string;
    title: string;
    detail: string;
    bar: string;
    faded: boolean;
  };
  const rows: Row[] = [
    // The booking, in the other's place.
    {
      key: "own",
      startsAt: partner.startsAt,
      endsAt: partner.endsAt,
      title: booking.customer.name,
      detail: t("screens.swap.moved", {
        ground: partner.ground.name ?? "",
        price: priced(partnerPrice, ownPrice),
      }),
      bar: "bg-primary",
      faded: false,
    },
    // The other, in the booking's place, when that's on this day.
    ...(onDay(booking.startsAt)
      ? [
          {
            key: "partner",
            startsAt: booking.startsAt,
            endsAt: booking.endsAt,
            title: partner.customer.name,
            detail: t("screens.swap.moved", {
              ground: groundName(booking.ground.id),
              price: priced(ownPrice, partnerPrice),
            }),
            bar: barOf(partner),
            faded: false,
          },
        ]
      : []),
    ...others
      .filter(
        (other) =>
          other.id !== booking.id &&
          other.id !== partner.id &&
          onDay(other.startsAt) &&
          grounds.has(other.ground.id),
      )
      .map((other) => ({
        key: other.id,
        startsAt: other.startsAt,
        endsAt: other.endsAt,
        title: other.customer.name,
        detail: t("screens.swap.detail", {
          ground: other.ground.name ?? "",
          kind: kindOf(other),
          price: money(other.total),
        }),
        bar: barOf(other),
        faded: true,
      })),
  ].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const a = places.own;
  const b = places.partner;
  const showsArrow = rows.some((row) => row.key === "partner") && a && b;

  return (
    // The bar is the screen's footer here, so the list just ends.
    <View className="gap-3 pt-5 pb-4">
      {rows.map((row) => (
        <View
          key={row.key}
          onLayout={place(row.key)}
          className={`flex-row items-center ${row.faded ? "opacity-40" : ""}`}
        >
          <HourColumn from={row.startsAt} to={row.endsAt} timezone={timezone} faded={row.faded} />
          <View className={`ms-3 w-1 self-stretch rounded-full ${row.bar}`} />
          <View className="ms-4 flex-1 py-1 pe-10">
            <Text className="text-subtitle">{row.title}</Text>
            <Text className="text-label text-ink-2">{row.detail}</Text>
          </View>
        </View>
      ))}
      {showsArrow ? <TradeArrow a={a} b={b} /> : null}
    </View>
  );
}

// A bracket on the right joining the two rows: out from each, round a soft corner, along a straight
// line between them, with a small solid head pointing back into each row.
const ARROW_WIDTH = 22;
const CORNER = 8;
const HEAD = 4;

function TradeArrow({
  a,
  b,
}: {
  a: { y: number; height: number };
  b: { y: number; height: number };
}) {
  const top = Math.min(a.y + a.height / 2, b.y + b.height / 2);
  const bottom = Math.max(a.y + a.height / 2, b.y + b.height / 2);
  const height = Math.max(bottom - top, CORNER * 2);
  const pad = HEAD + 1;
  const right = ARROW_WIDTH - 1;
  const start = HEAD + 1;
  const line = [
    `M${start} ${pad}`,
    `H${right - CORNER}`,
    `Q${right} ${pad} ${right} ${pad + CORNER}`,
    `V${pad + height - CORNER}`,
    `Q${right} ${pad + height} ${right - CORNER} ${pad + height}`,
    `H${start}`,
  ].join(" ");
  const head = (y: number) =>
    `M1 ${y} L${HEAD + 2} ${y - HEAD + 0.5} L${HEAD + 2} ${y + HEAD - 0.5} Z`;
  return (
    <View
      pointerEvents="none"
      className="absolute end-0"
      style={{ top: top - pad, width: ARROW_WIDTH, height: height + pad * 2 }}
    >
      <Svg width={ARROW_WIDTH} height={height + pad * 2}>
        <Path
          d={line}
          stroke={colors.primary}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d={head(pad)} fill={colors.primary} />
        <Path d={head(pad + height)} fill={colors.primary} />
      </Svg>
    </View>
  );
}
