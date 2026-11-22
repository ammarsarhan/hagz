import type {
  CandidateGroup,
  SlotCandidate,
  SlotCandidates,
  SlotCandidatesQuery,
} from "@hagz/contracts";
import type { GroundSport } from "@/generated/prisma/client";
import type { VenueAccess } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";
import { localToday } from "../domain/regulars";

// Fill a slot (PR 4.6, docs/regulars.md "Filling a slot from the venue's own customers"): a ranked
// list of the venue's customers to contact about an empty slot. Nothing is stored as a group: it's
// worked out from VenueCustomer's counters, their played games and the venue's thresholds on every
// request, so a changed threshold applies at once.

const DAY_MS = 24 * 60 * 60_000;
const WEEK_MS = 7 * DAY_MS;
const GROUP_ORDER: Record<CandidateGroup, number> = {
  LAPSED_REGULAR: 0,
  ACTIVE_REGULAR: 1,
  OTHER: 2,
};

const slotNotFound = () =>
  new AppError({ code: "SLOT_NOT_FOUND", status: 404, detail: "This venue has no such slot." });

interface Row {
  id: string;
  name: string;
  phone: string | null;
  customerId: string | null;
  bookingCount: number;
  noShowCount: number;
  lastBookedAt: Date | null;
  recent: number;
  fit: number;
  dow: number | null;
  hour: number | null;
  standing: boolean;
}

export const slotCandidates = async (
  actor: VenueAccess,
  slotId: string,
  { limit }: SlotCandidatesQuery,
  clock: Clock = systemClock,
): Promise<SlotCandidates> => {
  const now = clock.now();
  const slot = await prisma.groundSlot.findFirst({
    where: { id: slotId, venueId: actor.venueId },
    select: {
      id: true,
      groundId: true,
      startsAt: true,
      endsAt: true,
      status: true,
      ground: { select: { sport: true } },
    },
  });
  if (!slot) throw slotNotFound();
  const venue = await prisma.venue.findUniqueOrThrow({
    where: { id: actor.venueId },
    select: {
      marketplace: { select: { timezone: true } },
      settings: { select: { lapsedAfter: true, regularBookings: true, regularPeriod: true } },
    },
  });
  const timezone = venue.marketplace.timezone;
  const thresholds = venue.settings ?? { lapsedAfter: 3, regularBookings: 3, regularPeriod: 8 };
  const since = new Date(now.getTime() - thresholds.regularPeriod * WEEK_MS);
  const lapsedBefore = new Date(now.getTime() - thresholds.lapsedAfter * WEEK_MS);
  const today = localToday(now, timezone);

  const rows = await prisma.$queryRaw<Row[]>`
    WITH slot AS (
      SELECT extract(dow FROM ${slot.startsAt}::timestamptz AT TIME ZONE ${timezone})::int AS dow,
             extract(hour FROM ${slot.startsAt}::timestamptz AT TIME ZONE ${timezone})::int AS hour
    ),
    played AS (
      SELECT b."customerId" AS id, b."startsAt", b."groundId", g.sport,
             extract(dow FROM b."startsAt" AT TIME ZONE ${timezone})::int AS dow,
             extract(hour FROM b."startsAt" AT TIME ZONE ${timezone})::int AS hour
      FROM "Booking" b JOIN "Ground" g ON g.id = b."groundId"
      WHERE b."venueId" = ${actor.venueId}::uuid AND b.status = 'COMPLETED'
    ),
    stats AS (
      SELECT p.id,
             count(*) FILTER (WHERE p."startsAt" >= ${since})::int AS recent,
             (2 * count(*) FILTER (WHERE p.dow = slot.dow)
              + 2 * count(*) FILTER (WHERE p.hour = slot.hour)
              + count(*) FILTER (WHERE p."groundId" = ${slot.groundId}::uuid)
              + count(*) FILTER (WHERE p.sport = ${slot.ground.sport}::"GroundSport"))::int AS fit
      FROM played p CROSS JOIN slot
      GROUP BY p.id
    ),
    usual AS (
      SELECT DISTINCT ON (id) id, dow, hour
      FROM played
      GROUP BY id, dow, hour
      ORDER BY id, count(*) DESC, max("startsAt") DESC
    )
    SELECT c.id, c.name, c.phone, c."customerId", c."bookingCount", c."noShowCount",
           c."lastBookedAt", coalesce(s.recent, 0) AS recent, coalesce(s.fit, 0) AS fit,
           u.dow, u.hour,
           EXISTS (
             SELECT 1 FROM "VenueRegular" r
             WHERE r."customerId" = c.id AND r."pausedAt" IS NULL AND r."endedAt" IS NULL
               AND (r."endsOn" IS NULL OR r."endsOn" >= ${today}::date)
           ) AS standing
    FROM "VenueCustomer" c
    LEFT JOIN stats s ON s.id = c.id
    LEFT JOIN usual u ON u.id = c.id
    WHERE c."venueId" = ${actor.venueId}::uuid
      AND NOT EXISTS (
        SELECT 1 FROM "Booking" b
        WHERE b."customerId" = c.id
          AND b.status IN ('PENDING', 'HELD', 'UNCONFIRMED', 'CONFIRMED')
          AND b."startsAt" < ${slot.endsAt} AND b."endsAt" > ${slot.startsAt}
      )`;

  const groupOf = (row: Row): CandidateGroup => {
    const regular = row.standing || row.recent >= thresholds.regularBookings;
    if (!regular) return "OTHER";
    return !row.lastBookedAt || row.lastBookedAt < lapsedBefore
      ? "LAPSED_REGULAR"
      : "ACTIVE_REGULAR";
  };
  const noShowRate = (row: Row) =>
    row.noShowCount === 0 ? 0 : row.noShowCount / (row.bookingCount + row.noShowCount);
  const ranked = rows
    .map((row) => ({ row, group: groupOf(row) }))
    .sort(
      (a, b) =>
        GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
        b.row.fit - a.row.fit ||
        noShowRate(a.row) - noShowRate(b.row) ||
        (b.row.lastBookedAt?.getTime() ?? 0) - (a.row.lastBookedAt?.getTime() ?? 0) ||
        a.row.name.localeCompare(b.row.name),
    )
    .slice(0, limit);

  const data: SlotCandidate[] = [];
  for (const { row, group } of ranked) {
    const suggested =
      group === "ACTIVE_REGULAR" && row.dow !== null && row.hour !== null
        ? await nearUsual(
            actor.venueId,
            slot.id,
            slot.ground.sport,
            timezone,
            now,
            row.dow,
            row.hour,
          )
        : null;
    data.push({
      customer: { id: row.id, name: row.name, phone: row.phone, app: row.customerId !== null },
      group,
      standing: row.standing,
      gamesPlayed: row.bookingCount,
      noShows: row.noShowCount,
      lastPlayedAt: row.lastBookedAt?.toISOString() ?? null,
      usual: row.dow !== null && row.hour !== null ? { dayOfWeek: row.dow, hour: row.hour } : null,
      suggestedSlot: suggested,
    });
  }
  return {
    slot: {
      id: slot.id,
      groundId: slot.groundId,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      status: slot.status,
    },
    data,
  };
};

// A free slot of the same sport in the next 7 days on their usual weekday, nearest their usual hour.
const nearUsual = async (
  venueId: string,
  slotId: string,
  sport: GroundSport,
  timezone: string,
  now: Date,
  dow: number,
  hour: number,
) => {
  const [found] = await prisma.$queryRaw<
    { id: string; groundId: string; startsAt: Date; endsAt: Date }[]
  >`
    SELECT s.id, s."groundId", s."startsAt", s."endsAt"
    FROM "GroundSlot" s JOIN "Ground" g ON g.id = s."groundId"
    WHERE s."venueId" = ${venueId}::uuid AND s.status = 'AVAILABLE' AND s.id <> ${slotId}::uuid
      AND g.status = 'ACTIVE' AND g.sport = ${sport}::"GroundSport"
      AND s."startsAt" > ${now} AND s."startsAt" < ${new Date(now.getTime() + WEEK_MS)}
      AND extract(dow FROM s."startsAt" AT TIME ZONE ${timezone}) = ${dow}
    ORDER BY abs(extract(hour FROM s."startsAt" AT TIME ZONE ${timezone}) - ${hour}), s."startsAt"
    LIMIT 1`;
  return found
    ? {
        id: found.id,
        groundId: found.groundId,
        startsAt: found.startsAt.toISOString(),
        endsAt: found.endsAt.toISOString(),
      }
    : null;
};
