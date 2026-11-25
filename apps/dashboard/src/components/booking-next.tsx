import { CHECK_IN_OPENS_BEFORE_MINUTES } from "@hagz/contracts";
import type { components } from "@hagz/api";
import type { TFunction } from "i18next";
import type { Step } from "./step-rail";

// "What happens next" on an upcoming booking (Figma D17: deposit due 642:3, confirmed 642:100), as
// the step rail: what's been done (approved, paid), the step being waited on, and what follows
// (check-in opening, the rest paid here), with a payment due's grey branch: not paid in time.
// Who approved and when it was paid come from the booking's history. Null when there's nothing
// ahead to say: a staff hold, a booking already under way, or anything not HELD or CONFIRMED.

type Booking = components["schemas"]["StaffBookingDetail"];
type Event = components["schemas"]["BookingHistoryEvent"];

const MINUTE = 60_000;

export const showsNext = (booking: Booking, now: number) =>
  !booking.hold &&
  (booking.status === "HELD" ||
    (booking.status === "CONFIRMED" && now < Date.parse(booking.startsAt)));

export function nextSteps({
  booking,
  history,
  now,
  t,
  moment,
  money,
  name,
}: {
  booking: Booking;
  history: Event[];
  now: number;
  t: TFunction;
  // A time at the venue: today's alone, else with its day.
  moment: (at: string) => string;
  money: (minor: number) => string;
  name: string;
}): Step[] {
  const steps: Step[] = [];
  // History comes newest first: the latest of each.
  const approved = history.find((event) => event.type === "APPROVED");
  const confirmed = history.find((event) => event.type === "CONFIRMED");
  // Check-in is for app bookings, from 15 minutes before kick-off.
  const opensAt = new Date(
    Date.parse(booking.startsAt) - CHECK_IN_OPENS_BEFORE_MINUTES * MINUTE,
  ).toISOString();
  const checkIn = booking.source === "APP";

  if (booking.status === "HELD") {
    if (approved)
      steps.push({
        label: t("screens.booking.next.youApproved"),
        detail: approved.actor.name ?? undefined,
        when: moment(approved.createdAt),
        state: "done",
      });
    const deadline = booking.expiresAt ? moment(booking.expiresAt) : "";
    steps.push({
      label:
        booking.paymentMode === "DEPOSIT" && booking.deposit !== null
          ? t("screens.booking.next.paysDeposit", { name, amount: money(booking.deposit) })
          : t("screens.booking.next.pays", { name, amount: money(booking.total - booking.paid) }),
      when: deadline ? t("screens.booking.next.by", { time: deadline }) : "",
      state: "now",
      bold: "label",
    });
    if (checkIn)
      steps.push({
        label: t("screens.booking.next.checkInOpens"),
        when: moment(opensAt),
        state: "next",
      });
    steps.push({
      label: t("screens.booking.next.notPaid"),
      detail: t("screens.booking.next.backOnSale"),
      when: deadline,
      state: "maybe",
    });
    return steps;
  }

  // Confirmed and still to come.
  const left = booking.total - booking.paid;
  if (booking.paid > 0)
    steps.push({
      label: t(left > 0 ? "screens.booking.next.depositPaid" : "screens.booking.next.paidInFull"),
      detail: t("screens.booking.next.online", { amount: money(booking.paid) }),
      when: confirmed ? moment(confirmed.createdAt) : "",
      state: "done",
    });
  else if (approved)
    steps.push({
      label: t("screens.booking.next.youApproved"),
      detail: approved.actor.name ?? undefined,
      when: moment(approved.createdAt),
      state: "done",
    });
  const opened = now >= Date.parse(opensAt);
  if (checkIn)
    steps.push({
      label: t(opened ? "screens.booking.next.checkInOpened" : "screens.booking.next.checkInOpens"),
      when: moment(opensAt),
      state: opened ? "done" : "now",
    });
  if (left > 0)
    steps.push({
      label: t("screens.booking.next.paysRest", { name }),
      detail: t("screens.booking.next.restHow", { amount: money(left) }),
      when: moment(booking.startsAt),
      state: checkIn && !opened ? "next" : "now",
    });
  return steps;
}
