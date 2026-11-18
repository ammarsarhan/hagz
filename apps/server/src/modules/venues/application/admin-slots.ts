import type { AdminVenueSlots, AdminVenueSlotsQuery } from "@hagz/contracts";
import { prisma } from "@/platform/db/prisma";
import { venueNotFound } from "./access";
import { listGrounds } from "./grounds";

// A venue's admin Slots tab: one local day of its grounds' slots, read only. A venue's day is its
// marketplace's: Postgres turns the date into that day's two instants (`AT TIME ZONE` knows the
// zone's DST), so a day is 23 or 25 hours when the clocks change. Slots of deleted grounds are left
// out, as the grounds are.

export const adminVenueSlots = async (
  id: string,
  query: AdminVenueSlotsQuery,
): Promise<AdminVenueSlots> => {
  const venue = await prisma.venue.findUnique({
    where: { id },
    select: { marketplace: { select: { currency: true, timezone: true } } },
  });
  if (!venue) throw venueNotFound();
  const { currency, timezone } = venue.marketplace;

  // The days it has slots at all, and today, both in its timezone.
  const [span] = await prisma.$queryRaw<
    { first: string | null; last: string | null; today: string }[]
  >`
    SELECT (min(s."startsAt") AT TIME ZONE ${timezone})::date::text AS first,
           (max(s."startsAt") AT TIME ZONE ${timezone})::date::text AS last,
           (now() AT TIME ZONE ${timezone})::date::text AS today
    FROM "GroundSlot" s
    JOIN "Ground" g ON g.id = s."groundId"
    WHERE s."venueId" = ${id}::uuid AND g.status <> 'DELETED'`;
  const days = span?.first && span.last ? { first: span.first, last: span.last } : null;
  const today = span?.today ?? new Date().toISOString().slice(0, 10);
  // Asked for a day: that one. Otherwise today, or the nearest day with slots. ISO dates sort as
  // text.
  const date =
    query.date ??
    (days ? (today < days.first ? days.first : today > days.last ? days.last : today) : today);

  const [bounds] = await prisma.$queryRaw<{ from: Date; to: Date }[]>`
    SELECT (${date}::date::timestamp AT TIME ZONE ${timezone}) AS "from",
           ((${date}::date + 1)::timestamp AT TIME ZONE ${timezone}) AS "to"`;
  if (!bounds) throw new Error("Postgres returned no day bounds.");

  const grounds = await listGrounds(id, "EN");
  const slots = days
    ? await prisma.groundSlot.findMany({
        where: {
          venueId: id,
          groundId: { in: grounds.map((ground) => ground.id) },
          startsAt: { gte: bounds.from, lt: bounds.to },
        },
        orderBy: [{ startsAt: "asc" }, { groundId: "asc" }],
        select: {
          id: true,
          groundId: true,
          startsAt: true,
          endsAt: true,
          tier: true,
          price: true,
          status: true,
          isManual: true,
          bookingId: true,
        },
      })
    : [];

  return {
    timezone,
    currency,
    date,
    days,
    grounds: grounds.map(({ id: groundId, name, sport, size }) => ({
      id: groundId,
      name,
      sport,
      size,
    })),
    slots: slots.map((slot) => ({
      ...slot,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
    })),
  };
};
