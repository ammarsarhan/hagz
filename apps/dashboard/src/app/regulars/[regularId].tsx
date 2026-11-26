import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import type { components } from "@hagz/api";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { GroupHeading } from "@/components/group-heading";
import { useHud } from "@/components/hud";
import { IconBrandWhatsapp, IconDots, IconPhone } from "@/components/icons";
import { BarButton, BottomBar } from "@/components/bottom-bar";
import { BackButton, NavBar, RoundButton } from "@/components/nav";
import {
  RegularMenu,
  StateSheet,
  useResume,
  type RegularAction,
} from "@/components/regular-sheets";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { api } from "@/lib/api";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { hourLabel } from "@/lib/hours";
import { intlLocale } from "@/lib/language";
import { displayPhone, isolate } from "@/lib/phone";
import { hoursSpan, sentenceTime } from "@/lib/when";
import { push } from "@/lib/navigation";
import { regularQuery } from "@/lib/regulars";

// A regular (Figma D12 655:2), from the Regulars list: who, their weekly time, ground and since
// when; their number with Call and WhatsApp; the coming weeks as rows, each with the Calendar's bar
// (blue confirmed, pale blue waiting with its deadline, dashed skipped because the time is taken),
// a reservation opening its booking; then how the weeks have gone so far. ⋯ (bookings: manage)
// opens what can be done to it (Figma 655:111): Pause and End asked first in a sheet of their own
// (655:233); Change the time opens Select day for the new time (656:158). A confirm link isn't
// built yet.
//
// Paused (655:340): since when instead of since it began, only its confirmed weeks (nothing else is
// reserved meanwhile), and Resume in a bar. Ended, the list no longer shows it: the page closes.
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
  const canManage = venue?.permissions.bookings === "manage";
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<"pause" | "end" | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The menu's pick, acted on once the menu has slid away: one sheet at a time.
  const picked = useRef<RegularAction | null>(null);
  const { resume, sending: resuming } = useResume(venueId, regularId);
  const regular = useQuery(regularQuery(venueId, regularId));

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
  const paused = one.status === "PAUSED";
  // "today", or "24 Nov", in the venue's time.
  const pausedOn = (() => {
    if (!one.pausedAt) return "";
    const dateOf = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
    if (dateOf.format(new Date(one.pausedAt)) === dateOf.format(new Date())) return t(`${p}.today`);
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone: timezone,
      day: "numeric",
      month: "short",
    }).format(new Date(one.pausedAt));
  })();
  const comingNext = () => hud.show(t("common.comingNext"));
  const line = [
    t(`${p}.time`, {
      day: t(`screens.regulars.days.${String(one.dayOfWeek) as Weekday}`),
      hours: `${hourLabel(t, one.startHour)} – ${hourLabel(t, one.startHour + one.slotCount)}`,
    }),
    one.ground.name,
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
    <Screen
      footer={
        paused && canManage ? (
          <BottomBar title={t(`${p}.paused`)} detail={t(`${p}.pausedSince`, { date: pausedOn })}>
            <BarButton
              label={t(`${p}.resume`)}
              primary
              busy={resuming}
              onPress={() => void resume()}
            />
          </BottomBar>
        ) : undefined
      }
    >
      <NavBar
        flush
        start={<CompactTitle button={back} title={one.customer.name} style={compact.style} />}
        end={
          canManage && one.status !== "ENDED" ? (
            <RoundButton icon={IconDots} label={t(`${p}.more`)} onPress={() => setMenu(true)} />
          ) : undefined
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
        {/* Since when, on a line of its own right under (user, 2026-11-26). */}
        <Text className="text-subtitle text-ink-2">
          {paused ? t(`${p}.pausedLine`, { date: pausedOn }) : t(`${p}.since`, { date: since })}
        </Text>

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

        {/* Paused with nothing left, only the note follows: close under it. */}
        <GroupHeading
          className={`mt-7 ${paused && one.reservations.length === 0 ? "mb-1.5" : "mb-4"}`}
        >
          {t(`${p}.coming`)}
        </GroupHeading>
        <ComingWeeks regular={one} timezone={timezone} />
        {paused ? (
          // Right under the heading when there are no weeks above it (user, 2026-11-26).
          <Text
            className={`${one.reservations.length > 0 ? "mt-4" : ""} text-[14px] leading-[19px] text-ink-2`}
          >
            {t(`${p}.pausedNote`)}
          </Text>
        ) : null}

        <View className="mt-6 h-px bg-border" />
        <GroupHeading className="mt-7 mb-3">{t(`${p}.soFar`)}</GroupHeading>
        {figures.map((figure) => (
          <View key={figure.key} className="flex-row justify-between py-2">
            <Text className="text-[15px] leading-5 text-ink-2">{figure.label}</Text>
            <Text className="text-[15px] leading-5">{figure.value}</Text>
          </View>
        ))}
      </FadingScroll>

      <RegularMenu
        regular={one}
        visible={menu}
        onClose={() => setMenu(false)}
        onPick={(action) => {
          picked.current = action;
          setMenu(false);
        }}
        onHidden={() => {
          const action = picked.current;
          picked.current = null;
          if (action === "pause" || action === "end") {
            setSheet(action);
            setSheetOpen(true);
          } else if (action === "change") {
            push({ pathname: "/regulars/new", params: { regularId: one.id } });
          } else if (action === "resume") void resume();
          else if (action) comingNext();
        }}
      />
      {sheet ? (
        <StateSheet
          regular={one}
          action={sheet}
          venueId={venueId}
          timezone={timezone}
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onHidden={(changed) => {
            const ended = changed?.status === "ENDED";
            setSheet(null);
            if (ended) router.back();
          }}
        />
      ) : null}
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
  const hourOf = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "numeric",
    hourCycle: "h23",
  });
  // A week moved off the regular's own time (on the Calendar, Move or Swap): where it went. The
  // date column already says the day (user, 2026-11-26).
  const movedTo = (booking: Detail["reservations"][number]) => {
    const start = new Date(booking.startsAt);
    const weekday = new Date(`${dateOf.format(start)}T12:00:00Z`).getUTCDay();
    const hours = (Date.parse(booking.endsAt) - start.getTime()) / 3_600_000;
    const usual =
      booking.ground.id === regular.ground.id &&
      weekday === regular.dayOfWeek &&
      Number(hourOf.format(start).slice(0, 2)) === regular.startHour &&
      hours === regular.slotCount;
    if (usual) return undefined;
    return t(`${p}.movedTo`, {
      hours: hoursSpan(booking.startsAt, booking.endsAt, timezone, t),
      ground: booking.ground.name ?? "",
    });
  };
  const weeks = [
    ...regular.reservations.map((booking) => ({
      date: dateOf.format(new Date(booking.startsAt)),
      booking,
    })),
    // Paused, nothing is being reserved: no week is waiting for a free time.
    ...(regular.status === "PAUSED" ? [] : regular.skippedWeeks).map((date) => ({
      date,
      booking: null,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  if (weeks.length === 0) {
    // Paused: the page says why instead.
    if (regular.status === "PAUSED") return null;
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
            key={booking?.id ?? date}
            date={date}
            label={label}
            moved={booking ? movedTo(booking) : undefined}
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
  moved,
  detail,
  bar,
  onPress,
}: {
  date: string;
  label: string;
  // "Moved to 8 – 9 pm · Pitch 2", over the grey line.
  moved?: string;
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
      // Three lines (moved) get a taller row and bar (user, 2026-11-26).
      className={`${moved ? "min-h-[72px]" : "min-h-[52px]"} flex-row items-center active:opacity-60`}
    >
      <View className="w-14">
        <Text className="text-[15px] leading-5 font-semibold">{weekday.format(at)}</Text>
        <Text className="text-[13px] leading-[17px] text-ink-3">{dayMonth.format(at)}</Text>
      </View>
      <View
        className={`${moved ? "h-[72px]" : "h-[52px]"} w-1.5 rounded-[3px] ${
          bar === "confirmed"
            ? "bg-primary"
            : bar === "waiting"
              ? WEEKLY
              : "border-[1.5px] border-dashed border-ink-3"
        }`}
      />
      <View className="ms-3.5 flex-1">
        <Text className="text-[16px] leading-[21px] font-medium">{label}</Text>
        {moved ? (
          <Text className="text-[14px] leading-[19px] text-ink-2" numberOfLines={1}>
            {moved}
          </Text>
        ) : null}
        {detail ? (
          <Text className="text-[14px] leading-[19px] text-ink-2" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
