import type { GroundRemoval } from "@hagz/contracts";
import type { VenueAccess } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { localToday } from "../domain/regulars";
import { LIVE_STATUSES } from "../domain/status";
import { lockVenueRegulars, releaseWeeks } from "./regulars";
import { declineWaitingOnGround } from "./staff-decisions";

// Deleting a ground and what's booked on it (user, 2026-11-27), by the rules for hours that close
// (schedule-preview.ts): bookings and holds still to come go ahead and keep it on the calendar
// until the last one ends; requests waiting on it are declined; its regulars let their waiting
// (UNCONFIRMED) weeks go, keep the confirmed ones, and end after the last of them, or at once with
// none. groundRemoval says so before (nothing written); groundRemoved does it, in the delete's
// transaction, through venues' hook (http/router.ts). Removing itself is the venues module's
// (DELETE /grounds/{groundId}).

const groundNotFound = () =>
  new AppError({ code: "GROUND_NOT_FOUND", status: 404, detail: "There's no such ground here." });

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

// What still happens on it: bookings and holds still to come, requests aside, and regulars'
// waiting weeks too, unless one has already started (those aren't let go).
const ahead = (groundId: string, now: Date) => ({
  groundId,
  endsAt: { gt: now },
  OR: [
    {
      status: {
        in: LIVE_STATUSES.filter(
          (status) =>
            status !== "COMPLETED" &&
            status !== "NO_SHOW" &&
            status !== "PENDING" &&
            status !== "UNCONFIRMED",
        ),
      },
    },
    { status: "UNCONFIRMED" as const, startsAt: { lte: now } },
  ],
});

// Its regulars not ended, each with the start of the last week it keeps.
const endingRegulars = async (
  db: Tx | typeof prisma,
  venueId: string,
  groundId: string,
  now: Date,
) => {
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
    select: { id: true, customer: { select: { name: true } } },
  });
  const kept = await db.booking.findMany({
    where: { ...ahead(groundId, now), regularId: { in: regulars.map((regular) => regular.id) } },
    select: { regularId: true, startsAt: true },
  });
  return {
    timezone,
    regulars: regulars.map((regular) => {
      const starts = kept
        .filter((booking) => booking.regularId === regular.id)
        .map((booking) => booking.startsAt.getTime());
      return {
        id: regular.id,
        name: firstName(regular.customer.name),
        lastKept: starts.length > 0 ? new Date(Math.max(...starts)) : null,
      };
    }),
  };
};

export const groundRemoval = async (
  actor: VenueAccess,
  groundId: string,
  clock: Clock = systemClock,
): Promise<GroundRemoval> => {
  const now = clock.now();
  const ground = await prisma.ground.findFirst({
    where: { id: groundId, venueId: actor.venueId, status: { notIn: ["REMOVING", "DELETED"] } },
    select: { id: true },
  });
  if (!ground) throw groundNotFound();
  const where = ahead(groundId, now);
  const [bookings, requests, last, { timezone, regulars }] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.count({ where: { groundId, status: "PENDING", expiresAt: { gt: now } } }),
    prisma.booking.findFirst({ where, orderBy: { endsAt: "desc" }, select: { endsAt: true } }),
    endingRegulars(prisma, actor.venueId, groundId, now),
  ]);
  const dateOf = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
  return {
    bookings,
    requests,
    lastEndsAt: last?.endsAt.toISOString() ?? null,
    regulars: regulars.map(({ id, name, lastKept }) => ({
      id,
      name,
      lastWeek: lastKept ? dateOf.format(lastKept) : null,
    })),
  };
};

export const groundRemoved = async (
  tx: Tx,
  actor: VenueAccess,
  groundId: string,
  now: Date,
): Promise<void> => {
  // Before any booking's row, as everywhere regulars change, so a top-up can't deadlock with it.
  await lockVenueRegulars(tx, actor.venueId);
  await declineWaitingOnGround(tx, actor, groundId, now);
  const { timezone, regulars } = await endingRegulars(tx, actor.venueId, groundId, now);
  for (const regular of regulars) {
    await releaseWeeks(tx, regular.id, "GROUND_REMOVED", now);
    await tx.venueRegular.update({
      where: { id: regular.id },
      // Its last confirmed week is its last; with none, it ends now.
      data: regular.lastKept
        ? { endsOn: localToday(regular.lastKept, timezone) }
        : { endedAt: now },
    });
  }
};
