import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  FadeOutUp,
  LinearTransition,
} from "react-native-reanimated";
import type { components } from "@hagz/api";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { BarButton, BottomBar } from "./bottom-bar";
import { useHud } from "./hud";
import { Text } from "./text";

// How an ended game went, pinned at the bottom (Figma D8 530:2, D17 642:380; user, 2026-11-25: a
// bar, not a toggle mid-page): what it's marked as on the left with until when it can change, and
// the other outcome as a white pill on the right. A game is Played by itself once it ends; staff
// can flip it to No show, and back, until 24 hours after the end (the API's MARK_WINDOW_HOURS).
//
// The flip waits for the server (user, 2026-11-27, replacing the optimistic flip of 2026-11-26,
// which showed a change and then took it back when refused): the pill spins while it's asked, and
// only once it's saved comes the tick, the mark rolling over to the other one and the pill sliding
// to its new width. Refused, nothing moves and the HUD says why.

type Booking = components["schemas"]["StaffBookingDetail"];

const ROLL_MS = 200;

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
  // The mark the server saved, shown before the booking's read again catches up with it.
  const [saved, setSaved] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const read = booking.status === "COMPLETED";
  if (saved !== null && saved === read) setSaved(null);
  const played = saved ?? read;

  const flip = async () => {
    if (sending) return;
    const next = !played;
    setSending(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/bookings/{bookingId}/mark", {
        params: { path: { venueId, bookingId: booking.id } },
        body: { outcome: next ? "COMPLETED" : "NO_SHOW" },
      }),
    );
    setSending(false);
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    setSaved(next);
    void Haptics.selectionAsync();
    // The Calendar shows the mark too.
    void queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "bookings"] });
    await onChanged();
  };

  // Played rolls down out of the way as No show comes up from below, and back the other way.
  const roll = (key: string, text: string, className: string) => (
    <Animated.View
      key={key}
      entering={(played ? FadeInDown : FadeInUp).duration(ROLL_MS)}
      exiting={(played ? FadeOutUp : FadeOutDown).duration(ROLL_MS)}
      // Over each other while they pass, as the Venue tab's pinned title.
      className="absolute inset-x-0 top-0"
    >
      <Text className={className} numberOfLines={1}>
        {text}
      </Text>
    </Animated.View>
  );
  const markText = t(played ? "screens.booking.outcome.played" : "screens.booking.outcome.noShow");
  const otherText = t(played ? "screens.booking.outcome.noShow" : "screens.booking.outcome.played");

  return (
    <BottomBar
      title={
        <View className="h-[23px] overflow-hidden">
          {roll(`mark-${played}`, markText, "text-subtitle")}
        </View>
      }
      detail={t("screens.booking.outcome.until", { time: until })}
    >
      <Animated.View layout={LinearTransition.duration(ROLL_MS)}>
        <BarButton label={otherText} busy={sending} onPress={() => void flip()} />
      </Animated.View>
    </BottomBar>
  );
}
