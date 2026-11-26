import type { components } from "@hagz/api";
import type { TFunction } from "i18next";
import { hoursSpan } from "@/lib/when";
import type { Step } from "./step-rail";

// A cancelled booking (Figma D17: by the player 642:195, by you 642:289): what happened as a rail
// of steps done (who cancelled and why, the time back on sale, what goes back to the player), then
// where the money went. A venue's cancellation refunds everything, service fee too; a player's
// refunds the policy's share and Hagz keeps its service fee (user, 2026-11-23).
//
// Today the venue cancels only by declining a request or the player turning down a move; player
// cancellations and refunds come with Phase 5 and 6.1, and read the same `cancelled` data.

type Booking = components["schemas"]["StaffBookingDetail"];
type Event = components["schemas"]["BookingHistoryEvent"];
type Cancelled = NonNullable<Booking["cancelled"]>;

const HOUR = 3_600_000;

export function cancelledSteps({
  booking,
  cancelled,
  history,
  t,
  moment,
  money,
  name,
}: {
  booking: Booking;
  cancelled: Cancelled;
  history: Event[];
  t: TFunction;
  moment: (at: string) => string;
  money: (minor: number) => string;
  name: string;
}): Step[] {
  const at = moment(cancelled.at);
  const declined = history.find((event) => event.type === "DECLINED");
  const rejected = history.find((event) => event.type === "MOVE_REJECTED");
  const notice = Math.max(
    0,
    Math.floor((Date.parse(booking.startsAt) - Date.parse(cancelled.at)) / HOUR),
  );

  const who: Step =
    cancelled.initiator === "CUSTOMER"
      ? {
          label: t("screens.booking.cancelled.byPlayer", { name }),
          detail: t("screens.booking.cancelled.notice", { count: notice }),
          when: at,
          state: "done",
        }
      : cancelled.initiator === "ADMIN"
        ? {
            label: t("screens.booking.cancelled.byHagz"),
            detail: cancelled.reason ?? undefined,
            when: at,
            state: "done",
          }
        : rejected
          ? {
              label: t("screens.booking.cancelled.moveRejected", { name }),
              detail: t("screens.booking.cancelled.moveRejectedWhy"),
              when: at,
              state: "done",
            }
          : {
              label: declined?.actor.name
                ? t("screens.booking.cancelled.declinedBy", { name: declined.actor.name })
                : t("screens.booking.cancelled.byVenue"),
              detail: cancelled.reason ?? undefined,
              when: at,
              state: "done",
            };

  const steps: Step[] = [
    who,
    {
      label: t("screens.booking.cancelled.backOnSale", {
        hours: hoursSpan(booking.startsAt, booking.endsAt, booking.timezone, t),
      }),
      when: at,
      state: "done",
    },
  ];
  if (cancelled.refundAmount > 0)
    steps.push({
      label: t("screens.booking.cancelled.refund", { amount: money(cancelled.refundAmount), name }),
      detail:
        cancelled.initiator === "CUSTOMER" ? undefined : t("screens.booking.cancelled.everything"),
      when: at,
      state: "done",
    });
  return steps;
}

// Where the money went: what was paid, what goes back, Hagz's service fee when it keeps it (a
// player's cancellation), and what the venue keeps.
export function cancelledMoney(booking: Booking, cancelled: Cancelled) {
  const serviceFee = booking.charges
    .filter((charge) => charge.type === "SERVICE_FEE")
    .reduce((sum, charge) => sum + charge.amount, 0);
  const back = cancelled.refundAmount;
  const fee = cancelled.initiator === "CUSTOMER" ? Math.min(serviceFee, booking.paid - back) : 0;
  return { paid: booking.paid, back, fee, yours: Math.max(0, booking.paid - back - fee) };
}
