import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import type { components } from "@hagz/api";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { GroupHeading } from "@/components/group-heading";
import { useHud } from "@/components/hud";
import { IconBrandWhatsapp, IconDots, IconPhone } from "@/components/icons";
import { BackButton, NavBar, RoundButton } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { api } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { hourLabel } from "@/lib/hours";
import { intlLocale } from "@/lib/language";
import { displayPhone, isolate } from "@/lib/phone";
import { sentenceTime } from "@/lib/when";
import { push } from "@/lib/navigation";

// A regular (Figma D12 655:2), from the Regulars list: who, their weekly time, ground and since
// when; their number with Call and WhatsApp; the coming weeks as rows, each with the Calendar's bar
// (blue confirmed, pale blue waiting with its deadline, dashed skipped because the time is taken),
// a reservation opening its booking; then how the weeks have gone so far. The ⋯ (pause, change the
// time, end) comes next.
//
// The Figma's "Last 10 weeks" dots need each past week's outcome, which the API doesn't give yet
// (only the totals), so the totals are shown on their own under "So far".

type Detail = components["schemas"]["VenueRegularDetail"];
type Weekday = "0" | "1" | "2" | "3" | "4" | "5" | "6";

const FALLBACK_TIMEZONE = "Africa/Cairo";
const WEEKLY = "bg-[#c9d6ff]";

export default function RegularPage() {
  const { t } = useTranslation();
  const hud = useHud();
  const { regularId = "" } = useLocalSearchParams<{ regularId: string }>();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const compact = useCompactTitle();
  const regular = useQuery({
    queryKey: ["staff", "venues", venueId, "regulars", regularId],
    queryFn: async () => {
      const result = await send(
        api.GET("/v1/staff/venues/{venueId}/regulars/{regularId}", {
          params: { path: { venueId, regularId } },
        }),
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: venueId !== "",
  });

  const back = <BackButton label={t("components.shared.nav.back")} onPress={() => router.back()} />;
  const one = regular.data;
  if (!one) {
    return (
      <Screen>
        <NavBar flush start={back} />
        {regular.isError ? (
          <Text className="mt-4 text-body text-ink-2">{t("screens.regulars.page.failed")}</Text>
        ) : (
          <ActivityIndicator className="mt-10" color={colors.ink3} />
        )}
      </Screen>
    );
  }

  const p = "screens.regulars.page";
  const timezone = one.reservations[0]?.timezone ?? FALLBACK_TIMEZONE;
  const dayMonth = new Intl.DateTimeFormat(intlLocale, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
  const since = dayMonth.format(new Date(`${one.startsOn}T12:00:00Z`));
  const line = [
    t(`${p}.time`, {
      day: t(`screens.regulars.days.${String(one.dayOfWeek) as Weekday}`),
      hours: `${hourLabel(t, one.startHour)} – ${hourLabel(t, one.startHour + one.slotCount)}`,
    }),
    one.ground.name,
    t(`${p}.since`, { date: since }),
  ]
    .filter(Boolean)
    .join(" · ");
  const phone = one.customer.phone;
  const r = one.reliability;
  const figures = [
    {
      key: "confirmed",
      label: t(`${p}.confirmed`),
      value: t(`${p}.weeks`, { count: r.confirmed }),
    },
    { key: "released", label: t(`${p}.released`), value: t(`${p}.weeks`, { count: r.released }) },
    { key: "missed", label: t(`${p}.missed`), value: t(`${p}.weeks`, { count: r.missed }) },
    { key: "noShows", label: t(`${p}.noShows`), value: String(r.noShows) },
  ];

  return (
    <Screen>
      <NavBar
        flush
        start={<CompactTitle button={back} title={one.customer.name} style={compact.style} />}
        end={
          <RoundButton
            icon={IconDots}
            label={t(`${p}.more`)}
            onPress={() => hud.show(t("common.comingNext"))}
          />
        }
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Text
          accessibilityRole="header"
          className="text-title font-semibold tracking-[-0.4px]"
          onLayout={compact.onTitleLayout}
        >
          {one.customer.name}
        </Text>
        <Text className="mt-1.5 text-subtitle text-ink-2">{line}</Text>

        {phone ? (
          <View className="mt-5 flex-row items-center border-y border-border py-5">
            <View className="flex-1">
              <Text className="text-[14px] leading-[19px] text-ink-2">{t(`${p}.phone`)}</Text>
              <Text className="mt-0.5 text-[16px] leading-[21px] font-medium">
                {isolate(displayPhone(phone.replace(/^\+20/, "")))}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <RoundButton
                icon={IconPhone}
                label={t("screens.customer.call")}
                onPress={() => void Linking.openURL(`tel:${phone}`)}
              />
              <RoundButton
                icon={IconBrandWhatsapp}
                label={t("screens.customer.whatsapp")}
                onPress={() => void Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}`)}
              />
            </View>
          </View>
        ) : (
          <View className="mt-5 h-px bg-border" />
        )}

        <GroupHeading className="mt-7 mb-4">{t(`${p}.coming`)}</GroupHeading>
        <ComingWeeks regular={one} timezone={timezone} />

        <View className="mt-6 h-px bg-border" />
        <GroupHeading className="mt-7 mb-3">{t(`${p}.soFar`)}</GroupHeading>
        {figures.map((figure) => (
          <View key={figure.key} className="flex-row justify-between py-[5px]">
            <Text className="text-[15px] leading-5 text-ink-2">{figure.label}</Text>
            <Text className="text-[15px] leading-5">{figure.value}</Text>
          </View>
        ))}
      </FadingScroll>
    </Screen>
  );
}

// The weeks ahead, soonest first: its reservations (confirmed or waiting) and the weeks it couldn't
// reserve, each under its date.
function ComingWeeks({ regular, timezone }: { regular: Detail; timezone: string }) {
  const { t } = useTranslation();
  const p = "screens.regulars.page";
  const dateOf = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
  const deadline = new Intl.DateTimeFormat(intlLocale, {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const weeks = [
    ...regular.reservations.map((booking) => ({
      date: dateOf.format(new Date(booking.startsAt)),
      booking,
    })),
    ...regular.skippedWeeks.map((date) => ({ date, booking: null })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  if (weeks.length === 0) {
    return <Text className="text-body text-ink-2">{t(`${p}.noneComing`)}</Text>;
  }
  return (
    <View className="gap-5">
      {weeks.map(({ date, booking }) => {
        const confirmed = booking?.status === "CONFIRMED";
        const label = !booking
          ? t(`${p}.skipped`)
          : confirmed
            ? t(`${p}.confirmedWeek`)
            : t(`${p}.waiting`);
        const detail = !booking
          ? t(`${p}.skippedDetail`)
          : confirmed
            ? t(`${p}.code`, { code: booking.code })
            : booking.expiresAt
              ? t(`${p}.confirmBy`, {
                  date: deadline.format(new Date(booking.expiresAt)),
                  time: sentenceTime(booking.expiresAt, timezone, t),
                })
              : "";
        return (
          <WeekRow
            key={date}
            date={date}
            label={label}
            detail={detail}
            bar={!booking ? "skipped" : confirmed ? "confirmed" : "waiting"}
            onPress={booking ? () => push(`/booking/${booking.id}`) : undefined}
          />
        );
      })}
    </View>
  );
}

function WeekRow({
  date,
  label,
  detail,
  bar,
  onPress,
}: {
  date: string;
  label: string;
  detail: string;
  bar: "confirmed" | "waiting" | "skipped";
  onPress?: () => void;
}) {
  const at = new Date(`${date}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat(intlLocale, { timeZone: "UTC", weekday: "short" });
  const dayMonth = new Intl.DateTimeFormat(intlLocale, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      className="flex-row items-center active:opacity-60"
    >
      <View className="w-14">
        <Text className="text-[15px] leading-5 font-semibold">{weekday.format(at)}</Text>
        <Text className="text-[13px] leading-[17px] text-ink-3">{dayMonth.format(at)}</Text>
      </View>
      <View
        className={`h-10 w-1.5 rounded-[3px] ${
          bar === "confirmed"
            ? "bg-primary"
            : bar === "waiting"
              ? WEEKLY
              : "border-[1.5px] border-dashed border-ink-3"
        }`}
      />
      <View className="ms-3.5 flex-1">
        <Text className="text-[16px] leading-[21px] font-medium">{label}</Text>
        {detail ? (
          <Text className="text-[14px] leading-[19px] text-ink-2" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
