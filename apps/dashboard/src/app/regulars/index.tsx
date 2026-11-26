import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { Empty } from "@/components/empty";
import { NoWeeklyArt } from "@/components/empty-art";
import { FadingScroll } from "@/components/fading-scroll";
import { GroupHeading } from "@/components/group-heading";
import { useHud } from "@/components/hud";
import { IconChevronRight, IconPlus } from "@/components/icons";
import { BackButton, NavBar, RoundButton } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { bookingSettingsQuery } from "@/lib/booking-settings";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { hourLabel } from "@/lib/hours";
import { intlLocale, isRTL } from "@/lib/language";
import { overlaps, regularsQuery, weeksDecided, type Regular } from "@/lib/regulars";

// The venue's regulars (Figma D12 653:3), from the Venue tab: their weekly games under the weekday,
// Sundays first, each with its hours, who, the ground and how the weeks have gone. Regulars who
// want the same hours on a ground share one time, in priority order: "1st", then "2nd in line" (the
// one who gets a week the first lets go). Paused ones are greyed with the day they paused; ended ones
// are left out. + sets up a new weekly game (bookings: manage).

const FALLBACK_TIMEZONE = "Africa/Cairo";

// 0–6 from Sunday, as the API counts weekdays.
type Weekday = "0" | "1" | "2" | "3" | "4" | "5" | "6";

// Regulars that want the same hours, shown under one time; most stand alone.
type Group = Regular[];

export default function Regulars() {
  const { t } = useTranslation();
  const hud = useHud();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const canAdd = venue?.permissions.bookings === "manage";
  const compact = useCompactTitle();
  const regulars = useQuery(regularsQuery(venueId));
  const settings = useQuery(bookingSettingsQuery(venueId)).data;
  const comingNext = () => hud.show(t("common.comingNext"));

  const days = byDay(regulars.data ?? []);
  const title = t("screens.regulars.title");

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
        end={
          canAdd ? (
            <RoundButton
              icon={IconPlus}
              label={t("screens.regulars.add")}
              onPress={() => router.push("/regulars/new")}
            />
          ) : undefined
        }
      />
      <FadingScroll scrollY={compact.scrollY}>
        <Title
          small
          onTitleLayout={compact.onTitleLayout}
          subtitle={
            settings
              ? `${t("screens.regulars.horizon", { count: settings.regularHorizon })} ${deadlineLine(t, settings.confirmationWindow)}`
              : undefined
          }
        >
          {title}
        </Title>
        {regulars.isPending ? (
          <ActivityIndicator className="my-10" color={colors.ink3} />
        ) : regulars.isError ? (
          <Text className="mt-4 text-body text-ink-2">{t("screens.regulars.failed")}</Text>
        ) : days.length === 0 ? (
          <Empty
            art={<NoWeeklyArt scale={0.8} />}
            title={t("screens.regulars.noneTitle")}
            body={t("screens.regulars.none")}
            action={
              canAdd
                ? { label: t("screens.regulars.add"), onPress: () => router.push("/regulars/new") }
                : undefined
            }
          />
        ) : (
          days.map(({ day, groups }, index) => (
            <View key={day} className={index === 0 ? "mt-2" : "mt-6"}>
              <GroupHeading>{t(`screens.regulars.days.${String(day) as Weekday}`)}</GroupHeading>
              {groups.map((group) => (
                <TimeGroup key={group[0]?.id} group={group} onOpen={comingNext} />
              ))}
            </View>
          ))
        )}
      </FadingScroll>
    </Screen>
  );
}

// The weekdays that have regulars, Sunday first, each with its times. The list comes by weekday,
// hour, then priority, so regulars that overlap the ones before them join that time.
const byDay = (regulars: readonly Regular[]) => {
  const days: { day: number; groups: Group[] }[] = [];
  for (const regular of regulars) {
    if (regular.status === "ENDED") continue;
    let day = days.at(-1);
    if (!day || day.day !== regular.dayOfWeek) {
      day = { day: regular.dayOfWeek, groups: [] };
      days.push(day);
    }
    const shared = day.groups.find((group) => group.some((other) => overlaps(other, regular)));
    if (shared) shared.push(regular);
    else day.groups.push([regular]);
  }
  return days;
};

// "Each week waits for a confirm by the day before.", or so many days or hours before.
const deadlineLine = (t: TFunction, hours: number) =>
  hours === 24
    ? t("screens.regulars.confirmDay")
    : hours % 24 === 0
      ? t("screens.regulars.confirmDays", { count: hours / 24 })
      : t("screens.regulars.confirmHours", { count: hours });

// One time on the weekday: its hours once on the left, the regulars wanting it on the right, a
// hairline under each (indented between regulars sharing the time).
function TimeGroup({ group, onOpen }: { group: Group; onOpen: () => void }) {
  const { t } = useTranslation();
  const first = group[0];
  if (!first) return null;
  // The time is greyed when nobody in it is playing for now.
  const paused = group.every((regular) => regular.status === "PAUSED");
  return (
    <View className="flex-row border-b border-border">
      <View className="w-[60px] pt-3.5">
        <Text className={`text-[15px] leading-[20px] ${paused ? "text-ink-3" : "font-semibold"}`}>
          {hourLabel(t, first.startHour)}
        </Text>
        <Text className="text-[13px] leading-[17px] text-ink-3">
          {hourLabel(t, first.startHour + first.slotCount)}
        </Text>
      </View>
      <View className="flex-1">
        {group.map((regular, index) => (
          <Row
            key={regular.id}
            regular={regular}
            place={group.length > 1 ? index + 1 : null}
            divider={index < group.length - 1}
            onPress={onOpen}
          />
        ))}
      </View>
    </View>
  );
}

function Row({
  regular,
  place,
  divider,
  onPress,
}: {
  regular: Regular;
  place: number | null;
  divider: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const paused = regular.status === "PAUSED";
  const weeks = weeksDecided(regular);
  const line = [
    regular.ground.name,
    place === null
      ? null
      : place === 1
        ? t("screens.regulars.first")
        : t("screens.regulars.inLine", { count: place, ordinal: true }),
    paused && regular.pausedAt
      ? t("screens.regulars.paused", { date: dateLabel(regular.pausedAt) })
      : weeks > 0
        ? t("screens.regulars.confirmed", {
            confirmed: regular.reliability.confirmed,
            count: weeks,
          })
        : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-row items-center gap-4 py-3.5 active:opacity-60 ${divider ? "border-b border-border" : ""}`}
    >
      <View className="flex-1">
        <Text
          className={`text-[16px] font-medium leading-[21px] ${paused ? "text-ink-2" : ""}`}
          numberOfLines={1}
        >
          {regular.customer.name}
        </Text>
        <Text className="mt-0.5 text-[14px] leading-[19px] text-ink-2">{line}</Text>
      </View>
      <IconChevronRight
        size={20}
        color={colors.unit}
        strokeWidth={2}
        style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
      />
    </Pressable>
  );
}

// "12 Nov", in the venue's time (Egypt for now), with the year when it isn't this one.
const dateLabel = (at: string) => {
  const date = new Date(at);
  return new Intl.DateTimeFormat(intlLocale, {
    timeZone: FALLBACK_TIMEZONE,
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
};
