import type { components } from "@hagz/api";

// The Calendar tab's sums (Figma D6 round 2, "the day as a list"): venue-local days, the week they
// fall in, and a day's rows, from the venue's bookings and the slots staff closed. Dates are
// YYYY-MM-DD strings on the venue's calendar; moments are ISO instants.

export type StaffBooking = components["schemas"]["StaffBooking"];
export type Slot = components["schemas"]["Slot"];

const DAY = 86_400_000;

// The venue's local date (YYYY-MM-DD) of a moment.
export const localDateOf = (at: string | number, timezone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(at));

// A date some days on: addDays("2026-11-28", 1) is "2026-11-29".
export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

// The Sunday that starts a date's week (the strip runs S to S).
export const weekStartOf = (date: string) =>
  addDays(date, -new Date(`${date}T00:00:00Z`).getUTCDay());

// The week's seven dates from its Sunday.
export const weekOf = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

// A moment at the venue's clock: "4" and pm, "10:30" and pm, "12" and am.
export const clockOf = (at: string | number, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(at));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const pm = (parts.find((part) => part.type === "dayPeriod")?.value ?? "").toUpperCase() === "PM";
  return { time: minute === "00" ? hour : `${hour}:${minute}`, pm };
};

// What a booking row says about where it stands. The bar's look follows it: blue when confirmed,
// pale blue for a weekly game still to confirm, outlined blue for a request to answer, outlined pale
// blue for a time held, grey once it's over or closed. Colour carries no other meaning (staff
// screens have no red/green/amber status colours).
export type RowKind =
  "ended" | "confirmed" | "unconfirmed" | "request" | "hold" | "paying" | "closed";

export type CalendarRow =
  | { kind: "closed"; key: string; startsAt: string; endsAt: string; groundId: string }
  // Open slots nobody has: one row per time, naming every ground free then, and its prices' range.
  | {
      kind: "free";
      key: string;
      startsAt: string;
      endsAt: string;
      groundId: string;
      groundIds: string[];
      price: { from: number; to: number };
      ended: boolean;
    }
  | {
      kind: Exclude<RowKind, "closed">;
      key: string;
      startsAt: string;
      endsAt: string;
      groundId: string;
      booking: StaffBooking;
    };

const kindOf = (booking: StaffBooking, now: number): Exclude<RowKind, "closed"> => {
  if (
    Date.parse(booking.endsAt) <= now ||
    booking.status === "COMPLETED" ||
    booking.status === "NO_SHOW"
  )
    return "ended";
  switch (booking.status) {
    case "PENDING":
      return "request";
    case "UNCONFIRMED":
      return "unconfirmed";
    case "HELD":
      return booking.hold ? "hold" : "paying";
    default:
      return "confirmed";
  }
};

// Closed slots, a ground's back-to-back ones run together into one stretch.
const closedStretches = (slots: readonly Slot[]) => {
  const blocked = slots
    .filter((slot) => slot.status === "BLOCKED")
    .sort((a, b) => a.groundId.localeCompare(b.groundId) || a.startsAt.localeCompare(b.startsAt));
  const stretches: { groundId: string; startsAt: string; endsAt: string; first: string }[] = [];
  for (const slot of blocked) {
    const last = stretches.at(-1);
    if (
      last &&
      last.groundId === slot.groundId &&
      Date.parse(last.endsAt) === Date.parse(slot.startsAt)
    )
      last.endsAt = slot.endsAt;
    else
      stretches.push({
        groundId: slot.groundId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        first: slot.id,
      });
  }
  return stretches;
};

// Open slots nobody holds, every ground free at the same time in one row (user: not split by price).
const freeHours = (slots: readonly Slot[], order: (id: string) => number, now: number) => {
  const groups = new Map<string, Slot[]>();
  for (const slot of slots) {
    if (slot.status !== "AVAILABLE") continue;
    const key = `${slot.startsAt}|${slot.endsAt}`;
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }
  return [...groups].map(([key, group]) => {
    const groundIds = group.map((slot) => slot.groundId).sort((a, b) => order(a) - order(b));
    const [first] = group as [Slot, ...Slot[]];
    return {
      kind: "free" as const,
      key,
      startsAt: first.startsAt,
      endsAt: first.endsAt,
      groundId: groundIds[0] ?? first.groundId,
      groundIds,
      price: {
        from: Math.min(...group.map((slot) => slot.price)),
        to: Math.max(...group.map((slot) => slot.price)),
      },
      ended: Date.parse(first.endsAt) <= now,
    };
  });
};

// One day's rows, by start time then ground (in the venue's order). Free hours fill the day between
// bookings, so the whole day shows even with nothing booked. A row belongs to the day it
// starts on, so a game from 11 pm to 1 am shows once, on its first day.
export const dayRows = ({
  date,
  timezone,
  bookings,
  slots,
  groundOrder,
  groundId,
  now,
}: {
  date: string;
  timezone: string;
  bookings: readonly StaffBooking[];
  slots: readonly Slot[];
  groundOrder: readonly string[];
  groundId: string | null;
  now: number;
}): CalendarRow[] => {
  const onDay = (row: { startsAt: string; groundId: string }) =>
    localDateOf(row.startsAt, timezone) === date &&
    (groundId === null || row.groundId === groundId);
  const order = (id: string) => {
    const at = groundOrder.indexOf(id);
    return at === -1 ? groundOrder.length : at;
  };
  const rows: CalendarRow[] = [
    ...bookings
      .map((booking) => ({
        kind: kindOf(booking, now),
        key: booking.id,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        groundId: booking.ground.id,
        booking,
      }))
      .filter(onDay),
    ...closedStretches(slots)
      .filter(onDay)
      .map((stretch) => ({
        kind: "closed" as const,
        key: stretch.first,
        startsAt: stretch.startsAt,
        endsAt: stretch.endsAt,
        groundId: stretch.groundId,
      })),
    ...freeHours(
      slots.filter(
        (slot) =>
          localDateOf(slot.startsAt, timezone) === date &&
          (groundId === null || slot.groundId === groundId),
      ),
      order,
      now,
    ),
  ];
  return rows.sort(
    (a, b) =>
      Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
      order(a.groundId) - order(b.groundId) ||
      a.key.localeCompare(b.key),
  );
};

// The start of the venue-local hour a moment falls in, in milliseconds.
export const hourStartOf = (at: string, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(at));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const time = Date.parse(at);
  return time - (value("minute") * 60 + value("second")) * 1000 - (time % 1000);
};

// All grounds' rows under the hour each starts in (user: hour headings, so a three-hour booking
// and the hours free beside it don't read as rows out of order). Rows come in sorted by start.
export const hourGroups = (rows: readonly CalendarRow[], timezone: string) => {
  const groups: { hour: number; rows: CalendarRow[] }[] = [];
  for (const row of rows) {
    const hour = hourStartOf(row.startsAt, timezone);
    const last = groups.at(-1);
    if (last && last.hour === hour) last.rows.push(row);
    else groups.push({ hour, rows: [row] });
  }
  return groups;
};

// Where the now line goes in a day's rows: before the first that starts after now (the length when
// none does). Rows already under way stay above it.
export const nowIndex = (rows: readonly CalendarRow[], now: number) => {
  const at = rows.findIndex((row) => Date.parse(row.startsAt) > now);
  return at === -1 ? rows.length : at;
};

// The days with bookings on them, requests included, for the dots under the week strip.
export const bookingDays = (bookings: readonly StaffBooking[], timezone: string) =>
  new Set(bookings.map((booking) => localDateOf(booking.startsAt, timezone)));

// The weekday a date falls on, 0 for Sunday.
export const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
