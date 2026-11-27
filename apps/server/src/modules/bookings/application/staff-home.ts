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

// Open hours from `start` to the day's end, joined into runs per ground, soonest first.
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
      ground: { select: { translations: { select: { language: true, name: true } } } },
    },
  });
  const runs: StaffHome["free"] = [];
  let last: (typeof runs)[number] | undefined;
  for (const slot of slots) {
    if (last?.groundId === slot.groundId && last.endsAt === slot.startsAt.toISOString()) {
      last.endsAt = slot.endsAt.toISOString();
      last.slotIds.push(slot.id);
      continue;
    }
    last = {
      groundId: slot.groundId,
      groundName: groundName(slot.ground.translations),
      slotIds: [slot.id],
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      price: slot.price,
      currency,
    };
    runs.push(last);
  }
  return runs
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.groundId.localeCompare(b.groundId))
    .slice(0, FREE);
};
