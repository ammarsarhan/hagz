import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";
import type { components } from "@hagz/api";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { colors } from "@/lib/colors";
import { useHud } from "./hud";
import { Text } from "./text";

// How an ended game went, pinned at the bottom (Figma D8 530:2, D17 642:380; user, 2026-11-25: a
// bar, not a toggle mid-page): what it's marked as on the left with until when it can change, and
// the other outcome as a white pill on the right. A game is Played by itself once it ends; staff
// can flip it to No show, and back, until 24 hours after the end (the API's MARK_WINDOW_HOURS).

type Booking = components["schemas"]["StaffBookingDetail"];

export const MARK_WINDOW_MS = 24 * 3_600_000;

export const marksOutcome = (booking: Booking, now: number) =>
  (booking.status === "COMPLETED" || booking.status === "NO_SHOW") &&
  now <= Date.parse(booking.endsAt) + MARK_WINDOW_MS;

export function OutcomeBar({
  booking,
  venueId,
  until,
  onChanged,
}: {
  booking: Booking;
  venueId: string;
  // "7 pm tomorrow": when the mark stops changing.
  until: string;
  onChanged: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const played = booking.status === "COMPLETED";

  const flip = async () => {
    setSending(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/bookings/{bookingId}/mark", {
        params: { path: { venueId, bookingId: booking.id } },
        body: { outcome: played ? "NO_SHOW" : "COMPLETED" },
      }),
    );
    if (!result.ok) hud.show(hudMessage(result.error));
    // The Calendar shows the mark too.
    void queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "bookings"] });
    await onChanged();
    setSending(false);
  };

  return (
    <View>
      <View className="-mx-5 -mt-3 mb-3 h-px bg-border" />
      <View className="flex-row items-center">
        <View className="flex-1">
          <Text className="text-subtitle">
            {t(played ? "screens.booking.outcome.played" : "screens.booking.outcome.noShow")}
          </Text>
          <Text className="text-caption text-ink-2">
            {t("screens.booking.outcome.until", { time: until })}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: sending }}
          disabled={sending}
          onPress={() => void flip()}
          className="ms-3 h-12 min-w-28 items-center justify-center rounded-full border border-border bg-white px-5 active:opacity-70"
        >
          {sending ? (
            <ActivityIndicator color={colors.ink3} />
          ) : (
            <Text className="text-body font-medium">
              {t(played ? "screens.booking.outcome.noShow" : "screens.booking.outcome.played")}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
