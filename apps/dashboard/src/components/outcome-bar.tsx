import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { components } from "@hagz/api";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { BarButton, BottomBar } from "./bottom-bar";
import { useHud } from "./hud";

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
    <BottomBar
      title={t(played ? "screens.booking.outcome.played" : "screens.booking.outcome.noShow")}
      detail={t("screens.booking.outcome.until", { time: until })}
    >
      <BarButton
        label={t(played ? "screens.booking.outcome.noShow" : "screens.booking.outcome.played")}
        busy={sending}
        onPress={() => void flip()}
      />
    </BottomBar>
  );
}
