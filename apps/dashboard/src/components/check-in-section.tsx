import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";
import type { components } from "@hagz/api";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { sentenceTime } from "@/lib/when";
import { GroupHeading } from "./group-heading";
import { useHud } from "./hud";
import { IconCheck } from "./icons";
import { Text } from "./text";

// A booking's check-in (Figma D8 535:2 and 530:2, D17 642:380): who's here, out of everyone
// expected (the booker, then joined players), and when check-in is open. Someone in has an ink disc
// with a check and says when and how ("6:52 pm, with the code", "ticked in by name"); someone not
// yet has their initial in a ring and, while it's open and staff may, an underlined "Check in" that
// ticks them in by name. Once it has closed with nobody in, it just says so.

type CheckIn = NonNullable<components["schemas"]["StaffBookingDetail"]["checkIn"]>;
type Person = CheckIn["people"][number];

export function CheckInSection({
  venueId,
  bookingId,
  checkIn,
  timezone,
  now,
  canManage,
  onChanged,
}: {
  venueId: string;
  bookingId: string;
  checkIn: CheckIn;
  timezone: string;
  now: number;
  canManage: boolean;
  // After someone is ticked in: read the booking again.
  onChanged: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const [ticking, setTicking] = useState<string | null>(null);
  const open = now >= Date.parse(checkIn.opensAt) && now < Date.parse(checkIn.closesAt);
  const closed = now >= Date.parse(checkIn.closesAt);
  const here = checkIn.people.filter((person) => person.checkedInAt !== null).length;

  const tick = async (person: Person) => {
    setTicking(person.customerId);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/bookings/{bookingId}/check-ins", {
        params: { path: { venueId, bookingId } },
        body: { customerId: person.customerId },
      }),
    );
    if (!result.ok) hud.show(hudMessage(result.error));
    await onChanged();
    setTicking(null);
  };

  return (
    <View>
      <View className="flex-row items-baseline">
        <GroupHeading className="flex-1">{t("screens.booking.checkIn.title")}</GroupHeading>
        {checkIn.people.length > 1 ? (
          <Text className="text-label">
            {t("screens.booking.checkIn.here", { here, count: checkIn.people.length })}
          </Text>
        ) : null}
      </View>

      {closed && here === 0 ? (
        <View className="mt-3">
          <Text className="text-subtitle">{t("screens.booking.checkIn.nobody")}</Text>
          <Text className="mt-0.5 text-label text-ink-2">
            {t("screens.booking.checkIn.closedAt", {
              time: sentenceTime(checkIn.closesAt, timezone, t),
            })}
          </Text>
        </View>
      ) : (
        <>
          {closed ? null : (
            <Text className="mt-1 text-label text-ink-2">
              {t("screens.booking.checkIn.window", {
                from: sentenceTime(checkIn.opensAt, timezone, t),
                to: sentenceTime(checkIn.closesAt, timezone, t),
              })}
            </Text>
          )}
          <View className="mt-3 gap-2">
            {checkIn.people.map((person) => (
              <Row
                key={person.customerId}
                person={person}
                timezone={timezone}
                onTick={open && canManage ? () => void tick(person) : undefined}
                ticking={ticking === person.customerId}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function Row({
  person,
  timezone,
  onTick,
  ticking,
}: {
  person: Person;
  timezone: string;
  onTick?: () => void;
  ticking: boolean;
}) {
  const { t } = useTranslation();
  const role = t(
    person.role === "BOOKER" ? "screens.booking.checkIn.booker" : "screens.booking.checkIn.joined",
  );
  const how = person.checkedInAt
    ? t(person.manual ? "screens.booking.checkIn.byName" : "screens.booking.checkIn.withCode", {
        time: sentenceTime(person.checkedInAt, timezone, t),
      })
    : null;

  return (
    <View className="min-h-14 flex-row items-center">
      {person.checkedInAt ? (
        <View className="size-9 items-center justify-center rounded-full bg-ink">
          <IconCheck size={18} color={colors.white} strokeWidth={2.5} />
        </View>
      ) : (
        <View className="size-9 items-center justify-center rounded-full border border-border">
          <Text className="text-body font-medium text-ink-2">
            {person.firstName.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      <View className="ms-3.5 flex-1">
        <Text className="text-subtitle">{person.firstName}</Text>
        <Text className="text-label text-ink-2">{how ? `${role} · ${how}` : role}</Text>
      </View>
      {!person.checkedInAt && onTick ? (
        ticking ? (
          <ActivityIndicator color={colors.ink3} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("screens.booking.checkIn.tickLabel", { name: person.firstName })}
            onPress={onTick}
            hitSlop={8}
            className="ms-3 active:opacity-70"
          >
            <Text className="text-body font-medium underline">
              {t("screens.booking.checkIn.tick")}
            </Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}
