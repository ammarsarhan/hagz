import { useQuery, type QueryFilters } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, View } from "react-native";
import type { components } from "@hagz/api";
import { cancelledMoney, cancelledSteps } from "@/components/booking-cancelled";
import { nextSteps, showsNext } from "@/components/booking-next";
import { CheckInSection } from "@/components/check-in-section";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { GroupHeading } from "@/components/group-heading";
import { useHud } from "@/components/hud";
import { IconBrandWhatsapp, IconDots, IconPhone } from "@/components/icons";
import { BackButton, NavBar, RoundButton } from "@/components/nav";
import { Screen } from "@/components/screen";
import { SetupLoading } from "@/components/setup-loading";
import { StepRail } from "@/components/step-rail";
import { Text } from "@/components/text";
import { api } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { localDateOf } from "@/lib/calendar";
import { useCurrentVenue } from "@/lib/current-venue";
import { decimalsOf, formatAmount } from "@/lib/money";
import { isolate } from "@/lib/phone";
import { useRefreshWhenShown } from "@/lib/use-refresh";
import { useNow } from "@/lib/use-now";
import { dayLabel, hoursSpan, relativeDay, sentenceTime } from "@/lib/when";

// A booking, for staff (Figma D8, 535:2 and 530:2; its states in D17, 642:2): the code, the player
// as the title, when and where, their phone with call and WhatsApp, the price line by line with
// what's been paid, and how and when it was booked.
//
// Still to come on this page: the bottom bars (Scan a code, Played / No show, a request's answers), History and the ⋯
// menu.

type Booking = components["schemas"]["StaffBookingDetail"];

const HOUR = 3_600_000;

// What a price line is, after the hours it charges.
const CHARGE_KEYS = {
  AMENITY: "screens.booking.chargeAmenity",
  SERVICE_FEE: "screens.booking.chargeServiceFee",
  DISCOUNT: "screens.booking.chargeDiscount",
  REWARD: "screens.booking.chargeReward",
  ADJUSTMENT: "screens.booking.chargeAdjustment",
} as const;

export const bookingKey = (venueId: string, bookingId: string) => [
  "staff",
  "venues",
  venueId,
  "bookings",
  "detail",
  bookingId,
];

// The booking is read again when the page comes back into view (players pay, check in and cancel
// from elsewhere).
const REFRESHED: QueryFilters[] = [
  {
    predicate: ({ queryKey }) =>
      queryKey[0] === "staff" &&
      queryKey[1] === "venues" &&
      queryKey[3] === "bookings" &&
      queryKey[4] === "detail",
  },
];

export default function BookingPage() {
  const { bookingId = "" } = useLocalSearchParams<{ bookingId: string }>();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const booking = useQuery({
    queryKey: bookingKey(venueId, bookingId),
    queryFn: async () => {
      const result = await send(
        api.GET("/v1/staff/venues/{venueId}/bookings/{bookingId}", {
          params: { path: { venueId, bookingId } },
        }),
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: venueId !== "" && bookingId !== "",
  });
  useRefreshWhenShown(REFRESHED);
  if (!booking.data) return <SetupLoading query={booking} />;
  return (
    <Page
      booking={booking.data}
      venueId={venueId}
      canManage={venue?.permissions.bookings === "manage"}
      refetch={booking.refetch}
    />
  );
}

function Page({
  booking,
  venueId,
  canManage,
  refetch,
}: {
  booking: Booking;
  venueId: string;
  canManage: boolean;
  refetch: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const now = useNow((at) => Math.floor(at / 60_000) * 60_000 + 60_000);
  const comingNext = () => hud.show(t("common.comingNext"));
  const compact = useCompactTitle();
  const { timezone, ground, currency } = booking;
  const money = (minor: number) =>
    `${minor < 0 ? "−" : ""}${formatAmount(Math.abs(minor), decimalsOf(currency))} ${currency}`;
  const kind =
    ground.size === "STANDARD"
      ? t(`screens.setup.grounds.sports.${ground.sport}`)
      : t(`screens.setup.grounds.sizes.${ground.size}`);
  const name = booking.customer.name;
  const firstName = name.trim().split(/\s+/)[0] ?? name;

  // A moment at the venue: its time today, else the day and time.
  const moment = (at: string) =>
    localDateOf(at, timezone) === localDateOf(now, timezone)
      ? sentenceTime(at, timezone, t)
      : t("screens.booking.dayTime", {
          day: dayLabel(localDateOf(at, timezone), t),
          time: sentenceTime(at, timezone, t),
        });

  const chargeLabel = (charge: Booking["charges"][number]) =>
    charge.type === "SLOT"
      ? charge.startsAt
        ? hoursSpan(
            charge.startsAt,
            new Date(Date.parse(charge.startsAt) + HOUR).toISOString(),
            timezone,
            t,
          )
        : ""
      : t(CHARGE_KEYS[charge.type], { name: charge.amenity?.name ?? "" });

  const left = booking.total - booking.paid;
  const phone = booking.customer.phone;

  // What happens next, from who approved it and when it was paid; or, cancelled, who cancelled it
  // (its history).
  const upcoming = showsNext(booking, now);
  const cancelled = booking.status === "CANCELLED" ? booking.cancelled : null;
  const history = useQuery({
    queryKey: [...bookingKey(venueId, booking.id), "history"],
    queryFn: async () => {
      const result = await send(
        api.GET("/v1/staff/venues/{venueId}/bookings/{bookingId}/history", {
          params: { path: { venueId, bookingId: booking.id }, query: { limit: 50 } },
        }),
      );
      if (!result.ok) throw result.error;
      return result.data.data;
    },
    enabled: upcoming || cancelled !== null,
  });
  const steps =
    upcoming && history.data
      ? nextSteps({ booking, history: history.data, now, t, moment, money, name: firstName })
      : [];
  const story =
    cancelled && history.data
      ? cancelledSteps({
          booking,
          cancelled,
          history: history.data,
          t,
          moment,
          money,
          name: firstName,
        })
      : [];

  return (
    <Screen>
      {/* Pinned while the page scrolls under it, the code coming up beside back once its own label
          has gone under (the setup screens' compact title). */}
      <NavBar
        flush
        start={
          <CompactTitle
            button={
              <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
            }
            title={`#${booking.code}`}
            style={compact.style}
          />
        }
        end={<RoundButton icon={IconDots} label={t("screens.booking.more")} onPress={comingNext} />}
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Text
          className="text-caption font-medium tracking-[0.4px]"
          onLayout={compact.onTitleLayout}
        >{`#${booking.code}`}</Text>
        <Text
          accessibilityRole="header"
          className="mt-1 text-title font-semibold tracking-[-0.4px]"
        >
          {name}
        </Text>
        <Text className="mt-1.5 text-subtitle text-ink-2">
          {t("screens.booking.when", {
            day: relativeDay(localDateOf(booking.startsAt, timezone), now, timezone, t),
            hours: hoursSpan(booking.startsAt, booking.endsAt, timezone, t),
            ground: ground.name ?? "",
            kind,
          })}
        </Text>

        {phone ? (
          <Section>
            <View className="flex-row items-center">
              <View className="flex-1">
                <Text className="text-label text-ink-2">{t("screens.booking.phone")}</Text>
                <Text className="mt-0.5 text-subtitle">{isolate(spaced(phone))}</Text>
              </View>
              <RoundButton
                icon={IconPhone}
                label={t("screens.booking.call", { name: firstName })}
                onPress={() => void Linking.openURL(`tel:${phone}`)}
              />
              <View className="w-2" />
              <RoundButton
                icon={IconBrandWhatsapp}
                label={t("screens.booking.whatsapp", { name: firstName })}
                onPress={() => void Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}`)}
              />
            </View>
          </Section>
        ) : null}

        {steps.length > 1 ? (
          <Section title={t("screens.booking.next.title")}>
            <StepRail steps={steps} />
          </Section>
        ) : null}

        {cancelled ? (
          <Section title={t("screens.booking.cancelled.title")}>
            <StepRail steps={story} />
          </Section>
        ) : null}

        {booking.checkIn ? (
          <Section>
            <CheckInSection
              venueId={venueId}
              bookingId={booking.id}
              checkIn={booking.checkIn}
              timezone={timezone}
              now={now}
              canManage={canManage}
              onChanged={refetch}
            />
          </Section>
        ) : null}

        {booking.game ? (
          <Section title={t("screens.booking.openGame")}>
            <Text className="text-body text-ink-2">
              {t("screens.booking.joinFee", { amount: money(booking.game.joinFee) })}
            </Text>
          </Section>
        ) : null}

        {cancelled ? (
          <CancelledMoney booking={booking} cancelled={cancelled} money={money} name={firstName} />
        ) : (
          <Section title={t("screens.booking.price")}>
            {booking.charges.map((charge, index) => (
              <Line key={index} label={chargeLabel(charge)} value={money(charge.amount)} />
            ))}
            <View className="my-2.5 h-px bg-border" />
            <Line label={t("screens.booking.total")} value={money(booking.total)} strong />
            {booking.paid === 0 ? (
              <Line
                label={t("screens.booking.paidSoFar")}
                value={t("screens.booking.nothingYet")}
              />
            ) : (
              <>
                <Line label={t("screens.booking.paidOnline")} value={money(booking.paid)} />
                {left > 0 ? (
                  <Line label={t("screens.booking.leftHere")} value={money(left)} />
                ) : null}
                {booking.game && left <= 0 ? (
                  <Text className="mt-1 text-caption text-ink-2">
                    {t("screens.booking.paidInFullGame")}
                  </Text>
                ) : null}
              </>
            )}
          </Section>
        )}

        <Section title={t("screens.booking.details")}>
          <Line
            label={t("screens.booking.booked")}
            value={
              booking.source === "APP"
                ? t("screens.booking.inApp", { when: moment(booking.createdAt) })
                : booking.creator
                  ? t("screens.booking.byStaff", {
                      name: booking.creator.name,
                      when: moment(booking.createdAt),
                    })
                  : moment(booking.createdAt)
            }
          />
          <Line
            label={t("screens.booking.cancellation")}
            value={t(
              `screens.setup.settings.cancellation.policies.${booking.cancellation.policy}.title`,
            )}
          />
          <Pressable
            accessibilityRole="button"
            onPress={comingNext}
            hitSlop={8}
            className="mt-3 self-start active:opacity-70"
          >
            <Text className="text-body font-medium underline">{t("screens.booking.history")}</Text>
          </Pressable>
        </Section>
      </FadingScroll>
    </Screen>
  );
}

// "+201001234567" as "+20 100 123 4567".
const spaced = (phone: string) => {
  const match = /^\+20(\d{3})(\d{3})(\d+)$/.exec(phone);
  return match ? `+20 ${match[1]} ${match[2]} ${match[3]}` : phone;
};

// A cancelled booking's money: paid, back to the player, Hagz's service fee when it keeps it, and
// the venue's, with the policy's share when the player cancelled.
function CancelledMoney({
  booking,
  cancelled,
  money,
  name,
}: {
  booking: Booking;
  cancelled: NonNullable<Booking["cancelled"]>;
  money: (minor: number) => string;
  name: string;
}) {
  const { t } = useTranslation();
  const { paid, back, fee, yours } = cancelledMoney(booking, cancelled);
  const notice = Math.max(
    0,
    Math.floor((Date.parse(booking.startsAt) - Date.parse(cancelled.at)) / HOUR),
  );
  return (
    <Section title={t("screens.booking.cancelled.money")}>
      <Line
        label={t("screens.booking.cancelled.paid")}
        value={paid > 0 ? money(paid) : t("screens.booking.cancelled.nothing")}
      />
      {back > 0 ? (
        <Line label={t("screens.booking.cancelled.back", { name })} value={money(back)} />
      ) : null}
      {fee > 0 ? (
        <Line label={t("screens.booking.cancelled.serviceFee")} value={money(fee)} />
      ) : null}
      <View className="my-2.5 h-px bg-border" />
      <Line label={t("screens.booking.cancelled.yours")} value={money(yours)} strong />
      {cancelled.initiator === "CUSTOMER" ? (
        <Text className="mt-1 text-caption text-ink-2">
          {t("screens.booking.cancelled.policy", {
            policy: t(
              `screens.setup.settings.cancellation.policies.${booking.cancellation.policy}.title`,
            ),
            percent: cancelled.refundPercent,
            count: notice,
          })}
        </Text>
      ) : null}
    </Section>
  );
}

// A part of the page under a hairline, with its heading when it has one.
function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="mt-5 border-t border-border pt-5">
      {title ? <GroupHeading className="mb-3">{title}</GroupHeading> : null}
      {children}
    </View>
  );
}

// A label on the left and its value on the right.
function Line({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View className="flex-row items-baseline py-1">
      <Text className={`flex-1 text-body ${strong ? "" : "text-ink-2"}`}>{label}</Text>
      <Text className={`ms-4 text-body ${strong ? "font-semibold" : ""}`}>{value}</Text>
    </View>
  );
}
