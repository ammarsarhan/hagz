import { useQueries, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { FadingScroll } from "@/components/fading-scroll";
import { HoldFor } from "@/components/hold-for";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import { Chip } from "@/components/week-strip";
import { bookingSettingsQuery } from "@/lib/booking-settings";
import { addDays, localDateOf, weekStartOf, type Slot } from "@/lib/calendar";
import { useCurrentVenue } from "@/lib/current-venue";
import { colors } from "@/lib/colors";
import { hourLabel } from "@/lib/hours";
import { intlLocale } from "@/lib/language";
import { decimalsOf, formatAmount } from "@/lib/money";
import { datesLabel, regularsQuery, type Regular } from "@/lib/regulars";
import { useNow } from "@/lib/use-now";
import { weekSlots } from "@/lib/week-queries";

// A new weekly game, its first step (Figma D12 656:2): the weekday, then the ground (one at a time,
// as on Move and Hold a time; user, 2026-11-26: no All grounds), then the times it's free. Each
// free time is the ground's shortest game from that hour, dashed in blue with its price, and a dot
// for each of the weeks reserved ahead (the venue's regularHorizon): filled when that week is free,
// hollow when it's taken. Regulars already playing then are shown at their time.

// Until the first answer says the venue's; venues are in Egypt for now.
const FALLBACK_TIMEZONE = "Africa/Cairo";
const FALLBACK_HORIZON = 4;
const SOFT_FILL = "bg-[#f7f8ff]";
const WEEKLY = "bg-[#c9d6ff]";

// One time on the ground: the game from `hour`, on each of the weeks ahead (null: taken that week).
interface Time {
  hour: number;
  weeks: (Slot[] | null)[];
}

export default function NewRegular() {
  const { t } = useTranslation();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const compact = useCompactTitle();
  const now = useNow((at) => Math.floor(at / 60_000) * 60_000 + 60_000);
  const settings = useQuery(bookingSettingsQuery(venueId)).data;
  const horizon = settings?.regularHorizon ?? FALLBACK_HORIZON;
  const regulars = useQuery(regularsQuery(venueId)).data ?? [];

  const [timezone, setTimezone] = useState(FALLBACK_TIMEZONE);
  const today = localDateOf(now, timezone);
  const [weekday, setWeekday] = useState(() => new Date(`${today}T12:00:00Z`).getUTCDay());
  const [picked, setPicked] = useState<string | null>(null);
  // The free time tapped, while who it's for is asked.
  const [asking, setAsking] = useState<Time | null>(null);

  // The weekday's next dates, from today, one a week.
  const dates = useMemo(() => {
    const first = addDays(today, (weekday - new Date(`${today}T12:00:00Z`).getUTCDay() + 7) % 7);
    return Array.from({ length: horizon }, (_, week) => addDays(first, week * 7));
  }, [today, weekday, horizon]);
  // The calendar's weeks those dates fall in, read under the Calendar's own keys.
  const weekStarts = [...new Set(dates.map(weekStartOf))];
  const weeks = useQueries({
    queries: weekStarts.map((start) => weekSlots(venueId, start, venueId !== "")),
  });
  const loaded = weeks.every((week) => week.data !== undefined);
  const answer = weeks.find((week) => week.data)?.data;
  if (answer && answer.timezone !== timezone) setTimezone(answer.timezone);
  const currency = answer?.currency ?? "EGP";
  const grounds = answer?.grounds ?? [];
  const ground = grounds.find((one) => one.id === picked) ?? grounds[0];
  const length = ground?.minimumSlots ?? 1;
  const money = (minor: number) => `${formatAmount(minor, decimalsOf(currency))} ${currency}`;

  // The ground's times on the weekday, each with its game on every week ahead.
  const times = useMemo(() => {
    if (!ground || !loaded) return [];
    const hourOf = (at: string) =>
      Number(
        new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "numeric", hourCycle: "h23" })
          .format(new Date(at))
          .slice(0, 2),
      );
    // Each week's slots on the ground that day, by the hour they start.
    const byWeek = dates.map((date) => {
      const hours = new Map<number, Slot>();
      for (const week of weeks) {
        for (const slot of week.data?.slots ?? []) {
          if (slot.groundId === ground.id && localDateOf(slot.startsAt, timezone) === date) {
            hours.set(hourOf(slot.startsAt), slot);
          }
        }
      }
      return hours;
    });
    const starts = [...new Set(byWeek.flatMap((hours) => [...hours.keys()]))].sort((a, b) => a - b);
    // The game from `hour` that week, when every hour of it is free, back to back and still ahead.
    const gameAt = (hours: Map<number, Slot>, hour: number) => {
      const game: Slot[] = [];
      for (let step = 0; step < length; step += 1) {
        const slot = hours.get(hour + step);
        const before = game.at(-1);
        if (
          !slot ||
          slot.status !== "AVAILABLE" ||
          Date.parse(slot.startsAt) <= now ||
          (before && before.endsAt !== slot.startsAt)
        )
          return null;
        game.push(slot);
      }
      return game;
    };
    return starts
      .map((hour): Time => ({ hour, weeks: byWeek.map((hours) => gameAt(hours, hour)) }))
      .filter((time) => time.weeks.some(Boolean));
  }, [ground, loaded, weeks, dates, timezone, length, now]);

  // Regulars already playing on the ground that weekday, at the hour they start.
  const playing = regulars.filter(
    (regular) =>
      regular.status === "ACTIVE" &&
      regular.dayOfWeek === weekday &&
      regular.ground.id === ground?.id,
  );
  const rows = [
    ...times.map((time) => ({ hour: time.hour, time, regular: null })),
    ...playing.map((regular) => ({ hour: regular.startHour, time: null, regular })),
  ].sort((a, b) => a.hour - b.hour || (a.regular ? -1 : 1));
  // Under each hour: its regulars, then its free time.
  const groups: { hour: number; rows: typeof rows }[] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last?.hour === row.hour) last.rows.push(row);
    else groups.push({ hour: row.hour, rows: [row] });
  }

  // One object while asked: HoldFor opens its first sheet again whenever the target changes.
  const groundKey = ground?.id ?? "";
  const target = useMemo(
    () => (asking ? { groundId: groundKey, startsAt: "", endsAt: "" } : null),
    [asking, groundKey],
  );
  // "Tuesdays, 8 – 9 pm on Pitch 2".
  const whenLabel = (hour: number) =>
    t("screens.regulars.new.when", {
      day: t(`screens.regulars.days.${String(weekday) as Weekday}`),
      hours: `${hourLabel(t, hour)} – ${hourLabel(t, hour + length)}`,
      ground: ground?.name ?? "",
    });
  const title = t("screens.regulars.new.title");
  const letter = new Intl.DateTimeFormat(intlLocale, { timeZone: "UTC", weekday: "narrow" });
  const long = new Intl.DateTimeFormat(intlLocale, { timeZone: "UTC", weekday: "long" });
  // Sunday the 4th of January 2026, and the six days after it.
  const weekdays = Array.from({ length: 7 }, (_, day) => new Date(Date.UTC(2026, 0, 4 + day)));

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
          subtitle={t("screens.regulars.new.subtitle", { count: horizon })}
        >
          {title}
        </Title>
        <View className="flex-row justify-between">
          {weekdays.map((date, day) => (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={long.format(date)}
              accessibilityState={{ selected: day === weekday }}
              onPress={() => setWeekday(day)}
              className={`size-10 items-center justify-center rounded-full active:opacity-70 ${day === weekday ? "bg-ink" : "bg-chip"}`}
            >
              <Text
                className={`text-[15px] leading-5 font-medium ${day === weekday ? "text-white" : ""}`}
              >
                {letter.format(date)}
              </Text>
            </Pressable>
          ))}
        </View>
        {grounds.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -20, marginTop: 18 }}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          >
            {grounds.map((one) => (
              <Chip
                key={one.id}
                label={one.name ?? ""}
                on={one.id === ground?.id}
                onPress={() => setPicked(one.id)}
              />
            ))}
          </ScrollView>
        ) : null}
        <View className="mt-4 h-px bg-border" style={{ marginHorizontal: -20 }} />

        {!loaded ? (
          <ActivityIndicator className="mt-8" color={colors.ink3} />
        ) : (
          <View className="pt-4 pb-4">
            <Text className="text-[13px] leading-[17px] font-medium text-ink-2">
              {t("screens.regulars.new.dates", {
                day: t(`screens.regulars.days.${String(weekday) as Weekday}`),
                dates: datesLabel(t, dates),
              })}
            </Text>
            {times.length === 0 ? (
              <Text className="mt-4 text-body text-ink-2" style={{ maxWidth: "75%" }}>
                {t("screens.regulars.new.none")}
              </Text>
            ) : null}
            <View className="mt-3.5 gap-4">
              {groups.map((group) => (
                <View key={group.hour} className="flex-row">
                  {/* When it starts in weight, when it ends in grey under it. */}
                  <View className="w-14 pt-[7px]">
                    <Text className="text-[15px] leading-5 font-semibold">
                      {hourLabel(t, group.hour)}
                    </Text>
                    <Text className="text-[13px] leading-[17px] text-ink-3">
                      {hourLabel(t, group.hour + (group.rows[0]?.regular?.slotCount ?? length))}
                    </Text>
                  </View>
                  <View className="flex-1 gap-4">
                    {group.rows.map((row) =>
                      row.regular ? (
                        <RegularRow key={row.regular.id} regular={row.regular} />
                      ) : row.time ? (
                        <FreeTime
                          key={`free-${row.hour}`}
                          label={t("screens.move.zone", {
                            ground: ground?.name ?? "",
                            price: money(priceOf(row.time)),
                          })}
                          weeks={row.time.weeks.map(Boolean)}
                          onPress={() => setAsking(row.time)}
                        />
                      ) : null,
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </FadingScroll>

      {/* Who it's for (the hold's sheets, nothing held), then the last look. */}
      <HoldFor
        venueId={venueId}
        target={target}
        when={asking ? whenLabel(asking.hour) : ""}
        holdMinutes={null}
        onClose={() => setAsking(null)}
        onChoose={(choice) => {
          const time = asking;
          setAsking(null);
          if (!time || !ground) return;
          router.push({
            pathname: "/regulars/confirm",
            params: {
              groundId: ground.id,
              ground: ground.name ?? "",
              kind:
                ground.size === "STANDARD"
                  ? t(`screens.setup.grounds.sports.${ground.sport}`)
                  : t(`screens.setup.grounds.sizes.${ground.size}`),
              dayOfWeek: String(weekday),
              startHour: String(time.hour),
              slotCount: String(length),
              price: String(priceOf(time)),
              currency,
              dates: dates.join(","),
              free: time.weeks.map((week) => (week ? "1" : "0")).join(","),
              name: choice.name,
              phone: choice.phone ?? "",
              customer: JSON.stringify(choice.customer),
            },
          });
        }}
      />
    </Screen>
  );
}

type Weekday = "0" | "1" | "2" | "3" | "4" | "5" | "6";

// The game's price on its first free week.
const priceOf = (time: Time) =>
  (time.weeks.find(Boolean) ?? []).reduce((sum, slot) => sum + slot.price, 0);

// A free weekly time: dashed in blue with its ground and price, and a dot a week ahead, filled
// when that week is free.
function FreeTime({
  label,
  weeks,
  onPress,
}: {
  label: string;
  weeks: boolean[];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={`h-[52px] flex-row items-center rounded-[10px] border-[1.5px] border-dashed border-primary px-3.5 active:opacity-70 ${SOFT_FILL}`}
    >
      <Text className="flex-1 text-[14px] leading-[19px] font-medium">{label}</Text>
      <View className="flex-row gap-1.5">
        {weeks.map((free, index) => (
          <View
            key={index}
            className={`size-[9px] rounded-full ${free ? "bg-primary" : "border border-ink-3"}`}
          />
        ))}
      </View>
    </Pressable>
  );
}

// A regular already playing then: the weekly pale blue bar, who, and the ground.
function RegularRow({ regular }: { regular: Regular }) {
  const { t } = useTranslation();
  return (
    <View className="h-[52px] flex-row items-center">
      <View className={`h-11 w-1.5 rounded-[3px] ${WEEKLY}`} />
      <View className="ms-3.5">
        <Text className="text-[16px] leading-[21px] font-medium">{regular.customer.name}</Text>
        <Text className="text-[14px] leading-[19px] text-ink-2">
          {t("screens.regulars.new.weekly", { ground: regular.ground.name ?? "" })}
        </Text>
      </View>
    </View>
  );
}
