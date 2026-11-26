import type { SchedulePreview, WeekSchedule } from "@hagz/contracts";
import { instantOf, startsUnder, type VenueAccess } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { LIVE_STATUSES } from "../domain/status";
import { upcomingWeeks } from "../domain/regulars";

// What a new week of hours would leave behind on a ground (user, 2026-11-27), for the warning staff
// see before saving it: bookings still ahead in hours it closes (they go ahead), requests waiting in
// them (declined on save), and regulars whose weekly time it closes, wholly or in part (they keep
// the weeks already reserved and end after the last). Nothing is written. The hours are venues'
// (startsUnder); the bookings and regulars are read here.

// How far ahead a regular's weekly time is checked: two months covers a change of clocks, and stays
// inside the slots' 90 days, past which every hour reads as closed.
const REGULAR_WEEKS = 8;

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export const schedulePreview = async (
  actor: VenueAccess,
  groundId: string,
  week: WeekSchedule,
  clock: Clock = systemClock,
): Promise<SchedulePreview> => {
  const now = clock.now();
  const open = await startsUnder(actor.venueId, groundId, week, now);
  const closes = (startsAt: Date) =>
    startsAt.getTime() >= now.getTime() && !open.has(startsAt.getTime());

  const live = await prisma.booking.findMany({
    where: {
      groundId,
      endsAt: { gt: now },
      status: {
        in: LIVE_STATUSES.filter((status) => status !== "COMPLETED" && status !== "NO_SHOW"),
      },
    },
    select: {
      status: true,
      regularId: true,
      startsAt: true,
      slots: { select: { startsAt: true } },
    },
  });
  const hit = live.filter((booking) => booking.slots.some((slot) => closes(slot.startsAt)));

  const { timezone } = (
    await prisma.venue.findUniqueOrThrow({
      where: { id: actor.venueId },
      select: { marketplace: { select: { timezone: true } } },
    })
  ).marketplace;
  const regulars = await prisma.venueRegular.findMany({
    where: { groundId, endedAt: null, OR: [{ endsOn: null }, { endsOn: { gte: now } }] },
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
  const dateOf = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
  const closed = regulars.filter((regular) =>
    upcomingWeeks(regular, {
      now,
      timezone,
      horizonWeeks: REGULAR_WEEKS,
      confirmationHours: 0,
      instantOf,
    }).some((one) =>
      Array.from(
        { length: regular.slotCount },
        (_, i) => new Date(one.startsAt.getTime() + i * 3_600_000),
      ).some(closes),
    ),
  );

  return {
    bookings: hit.filter((booking) => booking.status !== "PENDING").length,
    requests: hit.filter((booking) => booking.status === "PENDING").length,
    regulars: closed.map((regular) => {
      const reserved = live
        .filter((booking) => booking.regularId === regular.id && booking.status !== "PENDING")
        .map((booking) => booking.startsAt.getTime());
      return {
        id: regular.id,
        name: firstName(regular.customer.name),
        lastWeek: reserved.length > 0 ? dateOf.format(new Date(Math.max(...reserved))) : null,
      };
    }),
  };
};
