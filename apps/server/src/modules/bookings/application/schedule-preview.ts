import type { SchedulePreview, WeekSchedule } from "@hagz/contracts";
import { instantOf, startsUnder, type VenueAccess } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/transaction";
import { localToday, upcomingWeeks } from "../domain/regulars";
import { LIVE_STATUSES } from "../domain/status";
import { lockVenueRegulars } from "./regulars";
import { declineIn } from "./staff-decisions";

// New hours on a ground and what's booked in the ones they close (user, 2026-11-27). Bookings and
// holds still ahead in them go ahead as booked; requests waiting in them are declined; regulars
// whose weekly time they close, wholly or in part, keep the weeks already reserved and end after
// the last one. schedulePreview says so before saving (nothing written); applyHoursChange does it,
// in the save's transaction, through venues' hook (http/router.ts). The open hours are venues'
// (startsUnder); the bookings and regulars are read here, the same way for both.

// How far ahead a regular's weekly time is checked: two months covers a change of clocks, and stays
// inside the slots' 90 days, past which every hour reads as closed.
const REGULAR_WEEKS = 8;
const HOUR_MS = 3_600_000;

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

const affected = async (
  db: Tx | typeof prisma,
  venueId: string,
  groundId: string,
  open: Set<number>,
  now: Date,
) => {
  const closes = (startsAt: Date) =>
    startsAt.getTime() >= now.getTime() && !open.has(startsAt.getTime());

  const live = await db.booking.findMany({
    where: {
      groundId,
      endsAt: { gt: now },
      status: {
        in: LIVE_STATUSES.filter((status) => status !== "COMPLETED" && status !== "NO_SHOW"),
      },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      status: true,
      regularId: true,
      startsAt: true,
      slots: { select: { startsAt: true } },
    },
  });
  const hit = live.filter((booking) => booking.slots.some((slot) => closes(slot.startsAt)));

  const { timezone } = (
    await db.venue.findUniqueOrThrow({
      where: { id: venueId },
      select: { marketplace: { select: { timezone: true } } },
    })
  ).marketplace;
  const today = localToday(now, timezone);
  const regulars = await db.venueRegular.findMany({
    where: { groundId, endedAt: null, OR: [{ endsOn: null }, { endsOn: { gte: today } }] },
    orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }],
    select: {
      id: true,
      dayOfWeek: true,
      startHour: true,
      slotCount: true,
      startsOn: true,
      endsOn: true,
      customer: { select: { name: true } },
    },
  });
  const closed = regulars.filter((regular) =>
    upcomingWeeks(regular, {
      now,
      timezone,
      horizonWeeks: REGULAR_WEEKS,
      confirmationHours: 0,
      instantOf,
    }).some((week) =>
      Array.from(
        { length: regular.slotCount },
        (_, i) => new Date(week.startsAt.getTime() + i * HOUR_MS),
      ).some(closes),
    ),
  );

  return {
    timezone,
    hit,
    regulars: closed.map((regular) => {
      // Requests are declined, so they're not weeks it keeps.
      const reserved = live
        .filter((booking) => booking.regularId === regular.id && booking.status !== "PENDING")
        .map((booking) => booking.startsAt.getTime());
      return {
        id: regular.id,
        name: firstName(regular.customer.name),
        lastReserved: reserved.length > 0 ? new Date(Math.max(...reserved)) : null,
      };
    }),
  };
};

export const schedulePreview = async (
  actor: VenueAccess,
  groundId: string,
  week: WeekSchedule,
  clock: Clock = systemClock,
): Promise<SchedulePreview> => {
  const now = clock.now();
  const open = await startsUnder(actor.venueId, groundId, week, now);
  const { timezone, hit, regulars } = await affected(prisma, actor.venueId, groundId, open, now);
  const dateOf = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
  return {
    bookings: hit.filter((booking) => booking.status !== "PENDING").length,
    requests: hit.filter((booking) => booking.status === "PENDING").length,
    regulars: regulars.map(({ id, name, lastReserved }) => ({
      id,
      name,
      lastWeek: lastReserved ? dateOf.format(lastReserved) : null,
    })),
  };
};

export const applyHoursChange = async (
  tx: Tx,
  actor: VenueAccess,
  groundId: string,
  open: Set<number>,
  now: Date,
): Promise<void> => {
  // Before any booking's row, as everywhere regulars change, so a top-up can't deadlock with it.
  await lockVenueRegulars(tx, actor.venueId);
  const { timezone, hit, regulars } = await affected(tx, actor.venueId, groundId, open, now);
  for (const booking of hit) {
    if (booking.status === "PENDING") {
      await declineIn(tx, actor, booking.id, now, { by: "SCHEDULE_CHANGED" });
    }
  }
  for (const regular of regulars) {
    await tx.venueRegular.update({
      where: { id: regular.id },
      // Its last reserved week is its last; with none, it ends now.
      data: regular.lastReserved
        ? { endsOn: localToday(regular.lastReserved, timezone) }
        : { endedAt: now },
    });
  }
};
