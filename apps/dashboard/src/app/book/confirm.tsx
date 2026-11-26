import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarButton, BottomBar } from "@/components/bottom-bar";
import type { Choice } from "@/components/hold-for";
import { useHud } from "@/components/hud";
import { TimePick } from "@/components/time-pick";
import { api } from "@/lib/api";
import { hudMessage, send } from "@/lib/api-errors";
import { useCurrentVenue } from "@/lib/current-venue";
import { decimalsOf, formatAmount } from "@/lib/money";
import { uuid } from "@/lib/uuid";
import { hoursSpan } from "@/lib/when";

// A new booking's last look (Figma D10 612:180): its day with the booking in its place, marked New,
// and a bar with who, the price and that it's paid at the venue, and Add booking. Staff bookings
// are confirmed at once. One idempotency key for the screen, so a retry after a dropped answer
// can't book twice. Added, the new booking's page takes the flow's place.

type Params = {
  groundId: string;
  startsAt: string;
  endsAt: string;
  price: string;
  total: string;
  currency: string;
  timezone: string;
  ground: string;
  note: string;
  name: string;
  customer: string;
};

export default function ConfirmBooking() {
  const { t } = useTranslation();
  const hud = useHud();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<Params>();
  const { venue } = useCurrentVenue();
  const venueId = venue?.id ?? "";
  const key = useRef(uuid());
  const [sending, setSending] = useState(false);
  const total = Number(params.total);
  const money = (minor: number) =>
    `${formatAmount(minor, decimalsOf(params.currency))} ${params.currency}`;

  const add = async () => {
    setSending(true);
    const customer = JSON.parse(params.customer) as Choice["customer"];
    const result = await send(
      api.POST("/v1/staff/venues/{venueId}/bookings", {
        params: { path: { venueId }, header: { "idempotency-key": key.current } },
        body: {
          groundId: params.groundId,
          startsAt: params.startsAt,
          endsAt: params.endsAt,
          customer,
          amenities: [],
          // The venue's own price only when it differs from the slots'.
          ...(total !== Number(params.price) ? { total } : {}),
          ...(params.note ? { note: params.note } : {}),
        },
      }),
    );
    setSending(false);
    void queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "bookings"] });
    void queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "slots"] });
    void queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, "customers"] });
    if (!result.ok) {
      hud.show(hudMessage(result.error));
      return;
    }
    // The picker, the price and this screen give way to the booking.
    router.dismiss(2);
    router.replace(`/booking/${result.data.id}`);
  };

  return (
    <TimePick
      mode="book"
      preview={{
        groundId: params.groundId,
        startsAt: params.startsAt,
        endsAt: params.endsAt,
        name: params.name,
        price: total,
      }}
      subtitle={t("screens.book.confirmSubtitle", {
        name: params.name,
        hours: hoursSpan(params.startsAt, params.endsAt, params.timezone, t),
        ground: params.ground,
      })}
      footer={
        <BottomBar
          title={t("screens.book.bar", { name: params.name, price: money(total) })}
          detail={t("screens.book.paidHere")}
        >
          <BarButton
            label={t("screens.book.add")}
            primary
            busy={sending}
            onPress={() => void add()}
          />
        </BottomBar>
      }
    />
  );
}
