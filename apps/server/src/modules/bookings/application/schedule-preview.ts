import type { SchedulePreview, WeekSchedule } from "@hagz/contracts";
import { instantOf, startsUnder, type VenueAccess } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/transaction";
import { localToday, upcomingWeeks } from "../domain/regulars";
import { LIVE_STATUSES } from "../domain/status";
import { lockVenueRegulars, releaseWeeks } from "./regulars";
import { declineIn } from "./staff-decisions";

// New hours on a ground and what's booked in the ones they close (user, 2026-11-27). Bookings and
// holds still ahead in them go ahead as booked; requests waiting in them are declined; regulars
// whose weekly time they close, wholly or in part, let their waiting (UNCONFIRMED) weeks go and end
// there and then, leaving the regulars list; their confirmed weeks still happen as booked (user,
// 2026-11-27), as when their ground is deleted (ground-removal.ts). schedulePreview says so before saving (nothing written); applyHoursChange does it,
// in the save's transaction, through venues' hook (http/router.ts). The open hours are venues'
// (startsUnder); the bookings and regulars are read here, the same way for both.

// How far ahead a regular's weekly time is checked: two months covers a change of clocks, and stays
// inside the slots' 90 days, past which every hour reads as closed.
const REGULAR_WEEKS = 8;
const HOUR_MS = 3_600_000;

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

// A regular's week still waiting for a confirm and not started: let go, not kept.
const letGo = (booking: { status: string; startsAt: Date }, now: Date) =>
  booking.status === "UNCONFIRMED" && booking.startsAt.getTime() > now.getTime();

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
  // A waiting week in a closed hour closes its regular's time too.
  const waitingHit = new Set(
    hit.filter((booking) => letGo(booking, now)).map((booking) => booking.regularId),
  );
  const closed = regulars.filter(
    (regular) =>
      waitingHit.has(regular.id) ||
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
      // Requests are declined and waiting weeks let go, so neither is a week it keeps.
      const reserved = live
        .filter(
          (booking) =>
            booking.regularId === regular.id &&
            booking.status !== "PENDING" &&
            !letGo(booking, now),
        )
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
    bookings: hit.filter((booking) => booking.status !== "PENDING" && !letGo(booking, now)).length,
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
  const { hit, regulars } = await affected(tx, actor.venueId, groundId, open, now);
  for (const booking of hit) {
    if (booking.status === "PENDING") {
      await declineIn(tx, actor, booking.id, now, { by: "SCHEDULE_CHANGED" });
    }
  }
  for (const regular of regulars) {
    await releaseWeeks(tx, regular.id, "SCHEDULE_CHANGED", now);
    // Only confirmed weeks are left, and no more come: it ends now (user, 2026-11-27).
    await tx.venueRegular.update({ where: { id: regular.id }, data: { endedAt: now } });
  }
};
