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
// The flip shows at once (user, 2026-11-26: it felt unsmooth waiting on the server): a tick, the
// mark rolling over to the other one and the pill sliding to its new width; back again, with the
// error, if the server refuses.

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
  // The mark as tapped, until the server's answer says the same.
  const [tapped, setTapped] = useState<boolean | null>(null);
  const saved = booking.status === "COMPLETED";
  if (tapped !== null && tapped === saved) setTapped(null);
  const played = tapped ?? saved;

  const flip = async () => {
    const next = !played;
    setTapped(next);
    void Haptics.selectionAsync();
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/bookings/{bookingId}/mark", {
        params: { path: { venueId, bookingId: booking.id } },
        body: { outcome: next ? "COMPLETED" : "NO_SHOW" },
      }),
    );
    if (!result.ok) {
      setTapped(null);
      hud.show(hudMessage(result.error));
    }
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
        <BarButton label={otherText} onPress={() => void flip()} />
      </Animated.View>
    </BottomBar>
  );
}
