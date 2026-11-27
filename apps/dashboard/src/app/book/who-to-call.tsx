import { useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, View } from "react-native";
import type { components } from "@hagz/api";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { GroupHeading } from "@/components/group-heading";
import { IconBrandWhatsapp, IconPhone } from "@/components/icons";
import { BackButton, NavBar, RoundButton } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { api } from "@/lib/api";
import { send } from "@/lib/api-errors";
import { localDateOf } from "@/lib/calendar";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { intlLocale } from "@/lib/language";
import { decimalsOf, formatAmount } from "@/lib/money";
import { useNow } from "@/lib/use-now";
import { hoursSpan, relativeDay, sentenceTime } from "@/lib/when";
import { guarded } from "@/components/guarded";
import { RULES } from "@/lib/access";

// Who to call about a free time (Figma D10 612:281): the time on top, then the venue's customers
// who fit it best and aren't booked then, from the API's Fill a slot, in its groups and order:
// regulars who haven't played lately, regulars, everyone else. Each with how much they've played
// and when last, their usual day as a little week with the hour, a regular's other free time near
// their usual one, and call and WhatsApp.

type Candidate = components["schemas"]["SlotCandidate"];
type Group = Candidate["group"];

const GROUPS: Group[] = ["LAPSED_REGULAR", "ACTIVE_REGULAR", "OTHER"];
const DAY_MS = 86_400_000;

function WhoToCall() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    slotId: string;
    startsAt: string;
    endsAt: string;
    ground: string;
    timezone: string;
    currency: string;
    price: string;
  }>();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const compact = useCompactTitle();
  const now = useNow((at) => Math.floor(at / 60_000) * 60_000 + 60_000);
  const { timezone, currency } = params;

  const candidates = useQuery({
    queryKey: ["staff", "venues", venueId, "slots", params.slotId, "candidates"],
    queryFn: async () => {
      const result = await send(
        api.GET("/v1/staff/venues/{venueId}/slots/{slotId}/candidates", {
          params: { path: { venueId, slotId: params.slotId }, query: { limit: 30 } },
        }),
      );
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: venueId !== "",
  });

  const money = (minor: number) => `${formatAmount(minor, decimalsOf(currency))} ${currency}`;
  const free = candidates.data ? candidates.data.slot.status === "AVAILABLE" : true;
  const title = t("screens.book.call.title");
  const groupTitle: Record<Group, string> = {
    LAPSED_REGULAR: t("screens.book.call.lapsed"),
    ACTIVE_REGULAR: t("screens.book.call.regulars"),
    // "Everyone else" only reads right under regulars; alone, they're just the venue's customers.
    OTHER: candidates.data?.data.some((one) => one.group !== "OTHER")
      ? t("screens.book.call.others")
      : t("screens.book.call.customers"),
  };

  return (
    <Screen>
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
          subtitle={t("screens.book.call.subtitle")}
        >
          {title}
        </Title>

        {/* The time to fill. */}
        <View className="flex-row items-center rounded-xl border border-dashed border-primary bg-[#f2f4ff] px-4 py-3">
          <View className="flex-1">
            <Text className="text-body">
              {t("screens.book.time", {
                day: relativeDay(localDateOf(params.startsAt, timezone), now, timezone, t),
                hours: hoursSpan(params.startsAt, params.endsAt, timezone, t),
                ground: params.ground,
              })}
            </Text>
            <Text className="text-caption text-ink-2">
              {free
                ? t("screens.book.call.freeAt", { price: money(Number(params.price)) })
                : t("screens.book.call.taken")}
            </Text>
          </View>
          {free ? (
            <Text className="ms-3 text-label text-primary">{t("screens.move.free")}</Text>
          ) : null}
        </View>

        {!candidates.data ? (
          candidates.isError ? (
            <Text className="mt-6 text-body text-ink-2">{t("screens.book.call.failed")}</Text>
          ) : (
            <ActivityIndicator className="mt-8" color={colors.ink3} />
          )
        ) : candidates.data.data.length === 0 ? (
          <Text className="mt-6 text-body text-ink-2" style={{ maxWidth: "75%" }}>
            {t("screens.book.call.none")}
          </Text>
        ) : (
          <View className="pb-4">
            {GROUPS.map((group) => {
              const people = candidates.data.data.filter((one) => one.group === group);
              if (people.length === 0) return null;
              return (
                <View key={group} className="mt-7">
                  <GroupHeading className="mb-1">{groupTitle[group]}</GroupHeading>
                  {people.map((person, index) => (
                    <Person
                      key={person.customer.id}
                      person={person}
                      last={index === people.length - 1}
                      timezone={timezone}
                      now={now}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        )}
      </FadingScroll>
    </Screen>
  );
}

// "8 pm" from the hour of the day.
const hourOf = (hour: number, t: TFunction) =>
  t("screens.calendar.time", {
    time: String(hour % 12 || 12),
    period: t(hour >= 12 ? "screens.calendar.pm" : "screens.calendar.am"),
  });

// The week's day letters from Sunday, in the app's language.
const weekLetters = () =>
  Array.from({ length: 7 }, (_, day) =>
    new Intl.DateTimeFormat(intlLocale, { weekday: "narrow", timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, 10, 1 + day)),
    ),
  );

function Person({
  person,
  last,
  timezone,
  now,
}: {
  person: Candidate;
  last: boolean;
  timezone: string;
  now: number;
}) {
  const { t } = useTranslation();
  const { customer } = person;
  const firstName = customer.name.trim().split(/\s+/)[0] ?? customer.name;

  // When they last played: today, yesterday, a weekday this week, or weeks ago.
  const lastPlayed = (() => {
    if (!person.lastPlayedAt) return null;
    const days = Math.floor(
      (Date.parse(`${localDateOf(now, timezone)}T00:00:00Z`) -
        Date.parse(`${localDateOf(person.lastPlayedAt, timezone)}T00:00:00Z`)) /
        DAY_MS,
    );
    if (days <= 0) return t("screens.book.call.lastToday");
    if (days === 1) return t("screens.book.call.lastYesterday");
    if (days < 7)
      return t("screens.book.call.lastOn", {
        day: new Intl.DateTimeFormat(intlLocale, { weekday: "long", timeZone: timezone }).format(
          new Date(person.lastPlayedAt),
        ),
      });
    return t("screens.book.call.lastWeeks", { count: Math.floor(days / 7) });
  })();

  const record = [
    person.gamesPlayed > 0
      ? t("screens.book.call.played", { count: person.gamesPlayed })
      : t("screens.book.call.neverPlayed"),
    lastPlayed,
    person.noShows > 0 ? t("screens.book.call.noShows", { count: person.noShows }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const letters = weekLetters();

  return (
    <View className={`flex-row items-center py-3.5 ${last ? "" : "border-b border-border"}`}>
      <View className="flex-1">
        <Text className="text-subtitle font-medium">{customer.name}</Text>
        <Text className="text-label text-ink-2">{record}</Text>
        {person.usual ? (
          // Their usual day as a little week, the day's disc stretched into a pill holding the
          // hour, so the two read as one (user: a separate hour felt disjointed).
          <View className="mt-1.5 flex-row items-center">
            {letters.map((letter, day) =>
              day === person.usual?.dayOfWeek ? (
                <View
                  key={day}
                  className="me-1 h-[18px] flex-row items-center rounded-full bg-primary px-1.5"
                >
                  <Text className="text-[10px] font-semibold text-on-primary">{letter}</Text>
                  <Text className="ms-1 text-[10px] font-medium text-on-primary">
                    {`– ${hourOf(person.usual.hour, t)}`}
                  </Text>
                </View>
              ) : (
                <View key={day} className="me-1 size-[18px] items-center justify-center">
                  <Text className="text-[10px] font-medium text-ink-3">{letter}</Text>
                </View>
              ),
            )}
          </View>
        ) : null}
        {person.suggestedSlot ? (
          <Text className="mt-1 text-label">
            {t("screens.book.call.orHere", {
              day: relativeDay(
                localDateOf(person.suggestedSlot.startsAt, timezone),
                now,
                timezone,
                t,
              ),
              time: sentenceTime(person.suggestedSlot.startsAt, timezone, t),
            })}
          </Text>
        ) : null}
      </View>
      {customer.phone ? (
        <>
          <RoundButton
            icon={IconPhone}
            label={t("screens.booking.call", { name: firstName })}
            onPress={() => void Linking.openURL(`tel:${customer.phone}`)}
          />
          <View className="w-2" />
          <RoundButton
            icon={IconBrandWhatsapp}
            label={t("screens.booking.whatsapp", { name: firstName })}
            onPress={() =>
              void Linking.openURL(`https://wa.me/${(customer.phone ?? "").replace(/\D/g, "")}`)
            }
          />
        </>
      ) : null}
    </View>
  );
}

export default guarded(RULES.book, WhoToCall);
