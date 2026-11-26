import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { components } from "@hagz/api";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { bookingRequests } from "@/lib/booking-requests";
import { BarButton, BottomBar } from "./bottom-bar";
import { useHud } from "./hud";
import { RequestSheet, type Answer } from "./request-sheets";

// The bars of a booking waiting on the venue, opened from the Calendar (whose row only names the
// action): a request to approve or decline, and a regular's week to confirm.

type Booking = components["schemas"]["StaffBookingDetail"];

// A request (PENDING): answer by its deadline, Decline or Approve, each asking first in the
// Requests screen's sheets. The request comes from the requests list, which has what the Approve
// sheet says (how long approving gives to pay); while that loads, or once it's gone, no bar.
export function RequestBar({
  booking,
  venueId,
  now,
  deadline,
}: {
  booking: Booking;
  venueId: string;
  now: number;
  deadline: string;
}) {
  const { t } = useTranslation();
  const requests = useQuery(bookingRequests(venueId));
  const request = requests.data?.find((one) => one.id === booking.id);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [open, setOpen] = useState(false);
  if (!request) return null;
  const ask = (which: Answer) => {
    setAnswer(which);
    setOpen(true);
  };
  return (
    <>
      <BottomBar
        title={t("screens.booking.request.title")}
        detail={t("screens.booking.request.by", { time: deadline })}
      >
        <BarButton label={t("screens.requests.decline")} onPress={() => ask("decline")} />
        <BarButton label={t("screens.requests.approve")} primary onPress={() => ask("approve")} />
      </BottomBar>
      {answer ? (
        <RequestSheet
          request={request}
          answer={answer}
          visible={open}
          now={now}
          onClose={() => setOpen(false)}
          onHidden={() => setAnswer(null)}
        />
      ) : null}
    </>
  );
}

// A regular's week (UNCONFIRMED): confirm it, usually after calling, by its deadline. Releasing it
// goes in the ⋯ menu with the regular's other actions (D12).
export function WeeklyBar({
  booking,
  venueId,
  deadline,
  onChanged,
}: {
  booking: Booking;
  venueId: string;
  deadline: string;
  onChanged: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const confirm = async () => {
    setSending(true);
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/reservations/{bookingId}/confirm", {
        params: { path: { venueId, bookingId: booking.id } },
      }),
    );
    if (!result.ok) hud.show(hudMessage(result.error));
    void queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "bookings"] });
    await onChanged();
    setSending(false);
  };
  return (
    <BottomBar
      title={t("screens.booking.weekly.title")}
      detail={t("screens.booking.weekly.by", { time: deadline })}
    >
      <BarButton
        label={t("screens.booking.weekly.confirm")}
        primary
        busy={sending}
        onPress={() => void confirm()}
      />
    </BottomBar>
  );
}
