import type { GroundRemoval } from "@hagz/contracts";
import type { VenueAccess } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";
import { LIVE_STATUSES } from "../domain/status";

// What removing a ground leaves behind, for the warning staff see first (user, 2026-11-27): its
// bookings still to come, which go ahead and keep it on the calendar until the last one ends, the
// requests waiting on it, which are declined, and the regulars on it, which keep the weeks they
// have and end with it. Removing itself is the venues
// module's (DELETE /grounds/{groundId}).

const groundNotFound = () =>
  new AppError({ code: "GROUND_NOT_FOUND", status: 404, detail: "There's no such ground here." });

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
  // Requests still waiting are declined when it's removed, so they don't keep it.
  const where = {
    groundId,
    endsAt: { gt: now },
    status: {
      in: LIVE_STATUSES.filter(
        (status) => status !== "COMPLETED" && status !== "NO_SHOW" && status !== "PENDING",
      ),
    },
  };
  const [bookings, requests, last, regulars] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.count({ where: { groundId, status: "PENDING", expiresAt: { gt: now } } }),
    prisma.booking.findFirst({ where, orderBy: { endsAt: "desc" }, select: { endsAt: true } }),
    prisma.venueRegular.findMany({
      where: { groundId, endedAt: null },
      orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }],
      select: { customer: { select: { name: true } } },
    }),
  ]);
  return {
    bookings,
    requests,
    lastEndsAt: last?.endsAt.toISOString() ?? null,
    regulars: regulars.map(
      (regular) => regular.customer.name.trim().split(/\s+/)[0] ?? regular.customer.name,
    ),
  };
};
