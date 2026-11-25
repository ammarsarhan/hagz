import { useQuery, type QueryFilters } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { GroupHeading } from "@/components/group-heading";
import { useHud } from "@/components/hud";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { SetupLoading } from "@/components/setup-loading";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { bookingRequests } from "@/lib/booking-requests";
import { addDays, localDateOf, type StaffBooking } from "@/lib/calendar";
import { useCurrentVenue } from "@/lib/current-venue";
import { decimalsOf, formatAmount } from "@/lib/money";
import { useRefreshWhenShown } from "@/lib/use-refresh";
import { useNow } from "@/lib/use-now";
import { dayLabel, hoursSpan, sentenceTime } from "@/lib/when";

// Booking requests (Figma D7 round 3, 538:2), from the Calendar's inbox button: the app bookings
// waiting for the venue's answer, grouped by the game's day ("Today", "Tomorrow", "Thu 26 Nov"),
// each with its deadline, hours, ground, price and how it's paid, and Approve and Decline side by
// side. One whose deadline passes drops off on the minute, as the sweeper lets it go.

const REFRESHED: QueryFilters[] = [
  {
    predicate: ({ queryKey }) =>
      queryKey[0] === "staff" &&
      queryKey[1] === "venues" &&
      queryKey[3] === "bookings" &&
      queryKey[4] === "pending",
  },
];

export default function BookingRequests() {
  const { venue } = useCurrentVenue();
  const requests = useQuery(bookingRequests(venue?.id ?? ""));
  useRefreshWhenShown(REFRESHED);
  if (!requests.data) return <SetupLoading query={requests} />;
  return <Requests requests={requests.data} />;
}

function Requests({ requests }: { requests: StaffBooking[] }) {
  const { t } = useTranslation();
  const hud = useHud();
  // The minute, so a request past its deadline leaves and Today becomes tomorrow's Today.
  const now = useNow((at) => Math.floor(at / 60_000) * 60_000 + 60_000);

  const days = useMemo(() => {
    const groups = new Map<string, StaffBooking[]>();
    for (const request of requests) {
      if (request.expiresAt && Date.parse(request.expiresAt) <= now) continue;
      const day = localDateOf(request.startsAt, request.timezone);
      groups.set(day, [...(groups.get(day) ?? []), request]);
    }
    return [...groups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, rows]) => ({
        day,
        rows: rows.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
      }));
  }, [requests, now]);

  const comingNext = () => hud.show(t("common.comingNext"));
  const heading = (day: string, timezone: string) => {
    const today = localDateOf(now, timezone);
    if (day === today) return t("screens.requests.today");
    if (day === addDays(today, 1)) return t("screens.requests.tomorrow");
    return dayLabel(day, t);
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
      >
        <NavBar
          start={
            <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />
          }
        />
        <Title subtitle={t("screens.requests.subtitle")}>{t("screens.requests.title")}</Title>
        {days.length === 0 ? (
          <Text className="text-body text-ink-2">{t("screens.requests.none")}</Text>
        ) : (
          days.map(({ day, rows }, index) => (
            <View key={day} className={index === 0 ? "" : "mt-7"}>
              <GroupHeading>{heading(day, rows[0]?.timezone ?? "Africa/Cairo")}</GroupHeading>
              {rows.map((request) => (
                <Request
                  key={request.id}
                  request={request}
                  onApprove={comingNext}
                  onDecline={comingNext}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

// One request: the player and the deadline, the game's hours, ground and price, then the two
// answers. A hairline under each.
function Request({
  request,
  onApprove,
  onDecline,
}: {
  request: StaffBooking;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  const { timezone, ground, currency } = request;
  const money = (minor: number) => `${formatAmount(minor, decimalsOf(currency))} ${currency}`;
  const kind =
    ground.size === "STANDARD"
      ? t(`screens.setup.grounds.sports.${ground.sport}`)
      : t(`screens.setup.grounds.sizes.${ground.size}`);

  return (
    <View className="border-b border-hairline pt-4 pb-5">
      <View className="flex-row items-baseline">
        <Text className="flex-1 text-subtitle font-medium" numberOfLines={1}>
          {request.customer.name}
        </Text>
        {request.expiresAt ? (
          <Text className="ms-3 text-label font-medium">
            {t("screens.requests.by", { time: sentenceTime(request.expiresAt, timezone, t) })}
          </Text>
        ) : null}
      </View>
      <Text className="mt-1 text-label leading-5 text-ink-2">
        {hoursSpan(request.startsAt, request.endsAt, timezone, t)}
      </Text>
      <Text className="text-label leading-5 text-ink-2">
        {t("screens.requests.ground", { ground: ground.name ?? "", kind })}
      </Text>
      <Text className="text-label leading-5 text-ink-2">
        {request.paymentMode === "DEPOSIT" && request.deposit !== null
          ? t("screens.requests.DEPOSIT", {
              price: money(request.total),
              deposit: money(request.deposit),
            })
          : t(`screens.requests.${request.paymentMode === "PLATFORM" ? "PLATFORM" : "MANUAL"}`, {
              price: money(request.total),
            })}
      </Text>
      <View className="mt-3.5 flex-row gap-3">
        <Answer label={t("screens.requests.approve")} primary onPress={onApprove} />
        <Answer label={t("screens.requests.decline")} onPress={onDecline} />
      </View>
    </View>
  );
}

// A 40 pt pill, half the row: blue for Approve, grey for Decline.
function Answer({
  label,
  primary = false,
  onPress,
}: {
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`h-10 flex-1 items-center justify-center rounded-full active:opacity-80 ${primary ? "bg-primary" : "bg-chip"}`}
    >
      <Text className={`text-body font-semibold ${primary ? "text-on-primary" : "text-ink"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
