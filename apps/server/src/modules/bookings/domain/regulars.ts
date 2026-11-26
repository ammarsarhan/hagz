import type { BookingStatus } from "@hagz/contracts";

// Regulars (PR 4.5, docs/regulars.md): a customer's standing weekly time. Pure: which weeks a
// regular plays, as instants, and how reliable they've been.

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

export interface Weekly {
  dayOfWeek: number; // 0–6 from Sunday, local.
  startHour: number; // 0–23 local.
  slotCount: number;
  startsOn: Date; // A calendar date (UTC midnight, as Postgres DATE comes back).
  endsOn: Date | null;
}

export interface Week {
  date: string; // YYYY-MM-DD, local.
  startsAt: Date;
  endsAt: Date;
  deadline: Date; // Confirm by then, or it's released.
}

const dayFormats = new Map<string, Intl.DateTimeFormat>();

// Today's date in a timezone, as UTC midnight.
export const localToday = (now: Date, timezone: string): Date => {
  let format = dayFormats.get(timezone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormats.set(timezone, format);
  }
  return new Date(`${format.format(now)}T00:00:00Z`);
};

export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

// The Sunday that starts a local day's calendar week, as the staff Calendar draws weeks. A regular
// plays once a week: a game it already has in a week (confirmed, or moved there) stands for that
// week, wherever and whenever it is.
export const weekOf = (localDay: Date) =>
  isoDate(new Date(localDay.getTime() - localDay.getUTCDay() * DAY_MS));

type InstantOf = (
  date: { year: number; month: number; day: number },
  hour: number,
  timezone: string,
) => number | null;

// The weeks a regular still has ahead, from today up to `horizonWeeks` weeks, that can still be
// confirmed (their deadline hasn't passed). A start the clocks skip (a DST jump) has no week.
export const upcomingWeeks = (
  regular: Weekly,
  {
    now,
    timezone,
    horizonWeeks,
    confirmationHours,
    instantOf,
  }: {
    now: Date;
    timezone: string;
    horizonWeeks: number;
    confirmationHours: number;
    instantOf: InstantOf;
  },
): Week[] => {
  const today = localToday(now, timezone).getTime();
  const first = Math.max(today, regular.startsOn.getTime());
  const last = Math.min(
    today + horizonWeeks * 7 * DAY_MS,
    regular.endsOn ? regular.endsOn.getTime() : Number.POSITIVE_INFINITY,
  );
  const offset = (regular.dayOfWeek - new Date(first).getUTCDay() + 7) % 7;
  const weeks: Week[] = [];
  for (let day = first + offset * DAY_MS; day <= last; day += 7 * DAY_MS) {
    const date = new Date(day);
    const start = instantOf(
      { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() },
      regular.startHour,
      timezone,
    );
    if (start === null) continue;
    const deadline = new Date(start - confirmationHours * HOUR_MS);
    if (deadline <= now) continue;
    weeks.push({
      date: isoDate(date),
      startsAt: new Date(start),
      endsAt: new Date(start + regular.slotCount * HOUR_MS),
      deadline,
    });
  }
  return weeks;
};

// How a regular's reservations went, leaving out the ones released because the regular itself was
// changed, paused or ended.
export interface Reliability {
  confirmed: number; // Confirmed by staff or the regular, whatever happened after.
  released: number; // Let go by staff or the regular before the deadline.
  missed: number; // Nobody answered by the deadline.
  cancelled: number; // Confirmed, then cancelled.
  noShows: number;
}

export interface ReservationOutcome {
  status: BookingStatus;
  confirmed: boolean; // Has a CONFIRMED event.
  releasedBy: "STAFF" | "CUSTOMER" | "DEADLINE" | "REGULAR" | null;
}

// How one of its weeks went, for the regular's last-weeks dots: played, a no-show, let go in time
// (or cancelled after confirming), or not answered by the deadline.
export type WeekOutcome = "PLAYED" | "NO_SHOW" | "LET_GO" | "NOT_ANSWERED";

// Its last `count` weeks that are settled, oldest first. A week still waiting, or confirmed and not
// yet played, isn't settled; one released because the regular changed isn't its doing.
export const lastWeeksOf = (
  rows: readonly (ReservationOutcome & { startsAt: Date })[],
  now: Date,
  timezone: string,
  count = 10,
): { date: string; outcome: WeekOutcome }[] =>
  rows
    .flatMap((row) => {
      const outcome: WeekOutcome | null =
        row.releasedBy === "REGULAR"
          ? null
          : row.releasedBy === "DEADLINE"
            ? "NOT_ANSWERED"
            : row.releasedBy !== null || (row.status === "CANCELLED" && row.confirmed)
              ? "LET_GO"
              : row.status === "NO_SHOW"
                ? "NO_SHOW"
                : row.confirmed &&
                    row.startsAt <= now &&
                    (row.status === "COMPLETED" || row.status === "CONFIRMED")
                  ? "PLAYED"
                  : null;
      return outcome ? [{ startsAt: row.startsAt, outcome }] : [];
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(-count)
    .map((week) => ({ date: isoDate(localToday(week.startsAt, timezone)), outcome: week.outcome }));

export const reliabilityOf = (rows: readonly ReservationOutcome[]): Reliability => {
  const counted = rows.filter((row) => row.releasedBy !== "REGULAR");
  return {
    confirmed: counted.filter((row) => row.confirmed).length,
    released: counted.filter((row) => row.releasedBy === "STAFF" || row.releasedBy === "CUSTOMER")
      .length,
    missed: counted.filter((row) => row.releasedBy === "DEADLINE").length,
    cancelled: counted.filter((row) => row.status === "CANCELLED" && row.confirmed).length,
    noShows: counted.filter((row) => row.status === "NO_SHOW").length,
  };
};
