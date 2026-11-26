import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";
import { CompactTitle, useCompactTitle } from "@/components/compact-title";
import { DayPickHeader, HourColumn } from "@/components/day-pick";
import { FadingScroll } from "@/components/fading-scroll";
import { HoldFor, type HoldTarget } from "@/components/hold-for";
import { BackButton, NavBar } from "@/components/nav";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { Title } from "@/components/title";
import {
  hourStartOf,
  localDateOf,
  weekStartOf,
  type Slot,
  type StaffBooking,
} from "@/lib/calendar";
import { colors } from "@/lib/colors";
import { useCurrentVenue } from "@/lib/current-venue";
import { decimalsOf, formatAmount } from "@/lib/money";
import { useNow } from "@/lib/use-now";
import { bookingSettingsQuery } from "@/lib/booking-settings";
import { weekBookings, weekSlots } from "@/lib/week-queries";
import { hoursSpan, relativeDay } from "@/lib/when";

// Hold a time (Figma D9 600:142, behind its sheet): the time first, then who it's for. The day
// under the week strip and the grounds, one ground at a time like Move and Swap, from the one the
// Calendar was on (else the first): each free time dashed in blue with its price, the bookings
// already there faded. Opened from the Calendar's +, on the Calendar's day. Tapping a free time
// asks who it's for (HoldFor), then opens the held booking.

const HOUR = 3_600_000;
const SOFT_FILL = "bg-[#f2f4ff]";
// Until the first answer says the venue's; venues are in Egypt for now.
const FALLBACK_TIMEZONE = "Africa/Cairo";

export default function HoldTime() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ date?: string; groundId?: string }>();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const compact = useCompactTitle();
  const now = useNow((at) => Math.floor(at / 60_000) * 60_000 + 60_000);

  const [day, setDay] = useState(() => params.date ?? localDateOf(now, FALLBACK_TIMEZONE));
  const [picked, setPicked] = useState<string | null>(params.groundId ?? null);
  const weekStart = weekStartOf(day);
  const slots = useQuery(weekSlots(venueId, weekStart, venueId !== ""));
  const bookings = useQuery(weekBookings(venueId, weekStart, venueId !== ""));
  const holdMinutes = useQuery(bookingSettingsQuery(venueId)).data?.staffHoldMinutes ?? null;
  // The free time tapped, while who it's for is asked.
  const [target, setTarget] = useState<HoldTarget | null>(null);

  const timezone = slots.data?.timezone ?? FALLBACK_TIMEZONE;
  const currency = slots.data?.currency ?? "EGP";
  const grounds = slots.data?.grounds ?? [];
  const groundId =
    grounds.find((ground) => ground.id === picked)?.id ?? grounds[0]?.id ?? picked ?? "";
  const groundName = (id: string) => grounds.find((ground) => ground.id === id)?.name ?? "";
  const money = (minor: number) => `${formatAmount(minor, decimalsOf(currency))} ${currency}`;
  const span = (from: string, to: string) => hoursSpan(from, to, timezone, t);

  // The day's hours on the ground: its free times still to come, and the bookings faded.
  const hours = useMemo(() => {
    type Item =
      | { kind: "free"; key: string; startsAt: string; slot: Slot }
      | { kind: "booked"; key: string; startsAt: string; booking: StaffBooking };
    const onDay = (at: string, ground: string) =>
      localDateOf(at, timezone) === day && ground === groundId;
    const items: Item[] = [
      ...(slots.data?.slots ?? [])
        .filter(
          (slot) =>
            slot.status === "AVAILABLE" &&
            Date.parse(slot.startsAt) > now &&
            onDay(slot.startsAt, slot.groundId),
        )
        .map((slot) => ({ kind: "free" as const, key: slot.id, startsAt: slot.startsAt, slot })),
      ...(bookings.data ?? [])
        .filter((booking) => onDay(booking.startsAt, booking.ground.id))
        .map((booking) => ({
          kind: "booked" as const,
          key: booking.id,
          startsAt: booking.startsAt,
          booking,
        })),
    ];
    items.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    const groups: { hour: number; items: Item[] }[] = [];
    for (const item of items) {
      const hour = hourStartOf(item.startsAt, timezone);
      const last = groups.at(-1);
      if (last?.hour === hour) last.items.push(item);
      else groups.push({ hour, items: [item] });
    }
    return groups;
  }, [slots.data, bookings.data, day, groundId, timezone, now]);
  const free = hours.some((group) => group.items.some((item) => item.kind === "free"));

  const title = t("screens.hold.title");

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
        <Title onTitleLayout={compact.onTitleLayout} subtitle={t("screens.hold.subtitle")}>
          {title}
        </Title>
        <DayPickHeader
          weekStart={weekStart}
          day={day}
          today={localDateOf(now, timezone)}
          onDay={setDay}
          grounds={grounds}
          groundId={groundId}
          onGround={setPicked}
        />

        {!slots.data || !bookings.data ? (
          <ActivityIndicator className="mt-8" color={colors.ink3} />
        ) : (
          <View className="gap-5 pt-5 pb-4">
            {free ? null : (
              <Text className="text-body text-ink-2" style={{ maxWidth: "75%" }}>
                {t("screens.hold.none")}
              </Text>
            )}
            {hours.map((group) => (
              <View key={group.hour} className="flex-row">
                <HourColumn
                  from={new Date(group.hour).toISOString()}
                  to={new Date(group.hour + HOUR).toISOString()}
                  timezone={timezone}
                />
                <View className="ms-3 flex-1 gap-2">
                  {group.items.map((item) =>
                    item.kind === "booked" ? (
                      <View key={item.key} className="flex-row py-1 opacity-40">
                        <View className="w-1 rounded-full bg-border" />
                        <View className="ms-4">
                          <Text className="text-subtitle">{item.booking.customer.name}</Text>
                          <Text className="text-label text-ink-2">
                            {t("screens.move.otherBooking", {
                              ground: item.booking.ground.name ?? "",
                              hours: span(item.booking.startsAt, item.booking.endsAt),
                            })}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        key={item.key}
                        accessibilityRole="button"
                        accessibilityLabel={t("screens.hold.zoneLabel", {
                          hours: span(item.slot.startsAt, item.slot.endsAt),
                          ground: groundName(item.slot.groundId),
                        })}
                        onPress={() =>
                          setTarget({
                            groundId: item.slot.groundId,
                            startsAt: item.slot.startsAt,
                            endsAt: item.slot.endsAt,
                          })
                        }
                        className={`h-12 flex-row items-center rounded-xl border border-dashed border-primary px-4 active:opacity-70 ${SOFT_FILL}`}
                      >
                        <Text className="flex-1 text-body">
                          {t("screens.move.zone", {
                            ground: groundName(item.slot.groundId),
                            price: money(item.slot.price),
                          })}
                        </Text>
                        <Text className="text-label text-primary">{t("screens.move.free")}</Text>
                      </Pressable>
                    ),
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </FadingScroll>

      <HoldFor
        venueId={venueId}
        target={target}
        when={
          target
            ? t("screens.hold.when", {
                day: relativeDay(localDateOf(target.startsAt, timezone), now, timezone, t),
                hours: span(target.startsAt, target.endsAt),
                ground: groundName(target.groundId),
              })
            : ""
        }
        holdMinutes={holdMinutes}
        onClose={() => setTarget(null)}
        onHeld={(held) => {
          setTarget(null);
          router.replace(`/booking/${held.id}`);
        }}
      />
    </Screen>
  );
}
