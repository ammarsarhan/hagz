import type { StaffHome, StaffHomeQuery } from "@hagz/contracts";
import type { Prisma } from "@/generated/prisma/client";
import type { VenueAccess } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { groundName } from "./admin-bookings";
import { MARK_WINDOW_HOURS } from "./staff-decisions";
import { presentStaff, staffSelect } from "./staff-bookings";

// The Home tab (Figma D21c 739:2, user 2026-11-27): on a venue-local day, what needs the staff
// member (requests, holds, games to mark, regulars' weeks, cash still to take), then the next games
// and the hours still open. Today counts what's waiting whenever it's for (a request for next week
// still needs an answer now); a later day counts only its own. Reading needs `bookings: view`; the
// cash needs `payments: view` too.

const NEXT = 3;
// A day's games: confirmed, a regular's week still to confirm, played or a no-show.
const GAME_STATUSES = ["UNCONFIRMED", "CONFIRMED", "COMPLETED", "NO_SHOW"] as const;
const FREE = 3;
const HOUR = 3_600_000;

const waiting = async (
  where: Prisma.BookingWhereInput,
  soonestBy: "expiresAt" | "endsAt" = "expiresAt",
): Promise<StaffHome["requests"]> => {
  const [count, first] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findFirst({
      where,
      orderBy: [{ [soonestBy]: "asc" }, { id: "asc" }],
      select: { id: true, expiresAt: true, endsAt: true },
    }),
  ]);
  const at = first ? (soonestBy === "expiresAt" ? first.expiresAt : first.endsAt) : null;
  return {
    count,
    soonest: at?.toISOString() ?? null,
    bookingId: count === 1 && first ? first.id : null,
  };
};

export const staffHome = async (
  actor: VenueAccess,
  query: StaffHomeQuery,
  clock: Clock = systemClock,
): Promise<StaffHome> => {
  const now = clock.now();
  const venueId = actor.venueId;
  const venue = await prisma.venue.findUniqueOrThrow({
    where: { id: venueId },
    select: {
      marketplace: { select: { timezone: true, currency: true } },
      settings: { select: { paymentWindow: true } },
    },
  });
  const { timezone, currency } = venue.marketplace;
  const [bounds] = await prisma.$queryRaw<{ from: Date; to: Date; today: boolean }[]>`
    SELECT (${query.date}::date::timestamp AT TIME ZONE ${timezone}) AS "from",
           ((${query.date}::date + 1)::timestamp AT TIME ZONE ${timezone}) AS "to",
           (${query.date}::date = (${now}::timestamptz AT TIME ZONE ${timezone})::date) AS today`;
  if (!bounds) throw new Error("Postgres returned no day bounds.");
  const { from, to, today } = bounds;
  const onDay = { startsAt: { gte: from, lt: to } };
  // Today: from now on; a later day: all of it.
  const ahead = { startsAt: { lt: to }, endsAt: { gt: today ? now : from } };

  const games = { venueId, status: { in: [...GAME_STATUSES] }, ...onDay };
  const seesMoney = actor.permissions.payments !== "none";
  const [requests, holds, toMark, weeks, cash, next, free, day] = await Promise.all([
    waiting({
      venueId,
      status: "PENDING",
      expiresAt: { gt: now },
      ...(today ? {} : onDay),
    }),
    waiting({
      venueId,
      status: "HELD",
      creatorId: { not: null },
      expiresAt: { gt: now },
      ...onDay,
    }),
    today
      ? waiting(
          {
            venueId,
            status: "COMPLETED",
            checkedInAt: null,
            // Ended in the window, whatever day it started (a game past midnight too).
            endsAt: { gt: new Date(now.getTime() - MARK_WINDOW_HOURS * HOUR), lte: now },
          },
          "endsAt",
        )
      : Promise.resolve({ count: 0, soonest: null, bookingId: null }),
    waiting({
      venueId,
      status: "UNCONFIRMED",
      expiresAt: { gt: now },
      ...(today ? {} : onDay),
    }),
    actor.permissions.payments !== "none" ? cashToTake(venueId, from, to, now, currency) : null,
    prisma.booking.findMany({
      where: { venueId, status: { in: ["HELD", "UNCONFIRMED", "CONFIRMED"] }, ...ahead, ...onDay },
      orderBy: [{ startsAt: "asc" }, { groundId: "asc" }, { id: "asc" }],
      take: NEXT,
      select: { ...staffSelect, checkedInAt: true },
    }),
    openHours(venueId, today ? now : from, to, currency),
    Promise.all([
      prisma.booking.count({ where: games }),
      prisma.booking.findFirst({
        where: { ...games, ...(today && { startsAt: { gte: now, lt: to } }) },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        select: { startsAt: true },
      }),
      prisma.groundSlot.groupBy({
        by: ["status"],
        where: { venueId, ...onDay, ground: { status: "ACTIVE" }, status: { not: "BLOCKED" } },
        _count: { _all: true },
      }),
      today
        ? prisma.booking.groupBy({
            by: ["checkedInAt"],
            where: { ...games, creatorId: null, startsAt: { gte: from, lte: now } },
            _count: { _all: true },
          })
        : null,
      seesMoney ? prisma.booking.aggregate({ where: games, _sum: { total: true } }) : null,
    ]),
  ]);
  const [gameCount, nextGame, slots, started, money] = day;
  const slotsIn = (status: string) =>
    slots.find((group) => group.status === status)?._count._all ?? 0;

  const terms = { now, paymentWindow: venue.settings?.paymentWindow ?? null };
  return {
    timezone,
    requests,
    holds,
    toMark,
    weeks,
    cash,
    games: { count: gameCount, next: nextGame?.startsAt.toISOString() ?? null },
    booked: {
      booked: slotsIn("BOOKED") + slotsIn("HELD"),
      open: slots.reduce((sum, group) => sum + group._count._all, 0),
    },
    checkIns: started
      ? {
          started: started.reduce((sum, group) => sum + group._count._all, 0),
          checkedIn: started
            .filter((group) => group.checkedInAt !== null)
            .reduce((sum, group) => sum + group._count._all, 0),
        }
      : null,
    takings: money ? { amount: money._sum.total ?? 0, currency } : null,
    next: next.map((row) => ({ ...presentStaff(row, terms), checkedIn: row.checkedInAt !== null })),
    free,
  };
};

// What's still to be paid at the venue for the day's games that haven't checked in or ended: the
// whole price when paid at the venue, what the deposit left otherwise. Holds owe nothing yet.
const cashToTake = async (venueId: string, from: Date, to: Date, now: Date, currency: string) => {
  const rows = await prisma.booking.findMany({
    where: {
      venueId,
      status: { in: ["UNCONFIRMED", "CONFIRMED"] },
      paymentMode: { in: ["MANUAL", "DEPOSIT"] },
      checkedInAt: null,
      startsAt: { gte: from, lt: to },
      endsAt: { gt: now },
    },
    select: { total: true, paymentMode: true, depositAmount: true },
  });
  const owed = rows.map((row) =>
    row.paymentMode === "MANUAL" ? row.total : row.total - (row.depositAmount ?? 0),
  );
  const due = owed.filter((amount) => amount > 0);
  return { amount: due.reduce((sum, amount) => sum + amount, 0), count: due.length, currency };
};

// A run of `length` open hours cut into games the ground allows (user, 2026-11-27): as long as a
// game there may run, from the start (6–12 at 3 at most: 6–9, 9–12; 6–11: 6–9, 9–11). A last piece
// shorter than the shortest game takes hours from the pieces before it while they stay long enough
// (7 hours at 2 to 3: 3, 2, 2); one that still can't be booked is left out. The lengths, in order.
export const bookablePieces = (length: number, shortest: number, longest: number): number[] => {
  const pieces: number[] = [];
  let left = length;
  while (left >= longest) {
    pieces.push(longest);
    left -= longest;
  }
  if (left === 0) return pieces;
  let need = shortest - left;
  for (let i = pieces.length - 1; i >= 0 && need > 0; i -= 1) {
    const give = Math.min(need, (pieces[i] ?? 0) - shortest);
    if (give <= 0) continue;
    pieces[i] = (pieces[i] ?? 0) - give;
    left += give;
    need -= give;
  }
  return need > 0 ? pieces : [...pieces, left];
};

// Open hours from `start` to the day's end, joined into runs per ground and cut into games the
// ground allows (bookablePieces), soonest first.
const openHours = async (venueId: string, start: Date, to: Date, currency: string) => {
  const slots = await prisma.groundSlot.findMany({
    where: {
      venueId,
      status: "AVAILABLE",
      startsAt: { gte: start, lt: to },
      ground: { status: "ACTIVE" },
    },
    orderBy: [{ groundId: "asc" }, { startsAt: "asc" }],
    select: {
      id: true,
      groundId: true,
      startsAt: true,
      endsAt: true,
      price: true,
      ground: {
        select: {
          settings: { select: { minimumSlots: true, maximumSlots: true } },
          translations: { select: { language: true, name: true } },
        },
      },
    },
  });
  // Back-to-back open hours per ground, then each run cut into bookable pieces.
  const whole: (typeof slots)[] = [];
  for (const slot of slots) {
    const current = whole.at(-1);
    const previous = current?.at(-1);
    if (
      current &&
      previous?.groundId === slot.groundId &&
      previous.endsAt.getTime() === slot.startsAt.getTime()
    ) {
      current.push(slot);
    } else whole.push([slot]);
  }
  const runs: StaffHome["free"] = [];
  for (const run of whole) {
    const first = run[0];
    if (!first) continue;
    let at = 0;
    for (const length of bookablePieces(
      run.length,
      first.ground.settings?.minimumSlots ?? 1,
      first.ground.settings?.maximumSlots ?? 3,
    )) {
      const piece = run.slice(at, at + length);
      at += length;
      const head = piece[0];
      const tail = piece.at(-1);
      if (!head || !tail) continue;
      runs.push({
        groundId: head.groundId,
        groundName: groundName(head.ground.translations),
        slotIds: piece.map((slot) => slot.id),
        startsAt: head.startsAt.toISOString(),
        endsAt: tail.endsAt.toISOString(),
        price: head.price,
        currency,
      });
    }
  }
  return runs
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.groundId.localeCompare(b.groundId))
    .slice(0, FREE);
};
