import type { Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";

// How much a player can have on at once where nothing is paid up front (user, 2026-11-23), so
// no-shows cost a venue little: bookings paid at the venue, games joined (paid in person), and games
// hosted. Prepaid bookings, and those with a deposit, aren't limited. Tournaments (Phase 4b) won't
// count. Only what the player did in the app counts: staff entries and a regular's weekly
// reservations are the venue's own arrangements.
//
// Each check takes a lock on the player first, inside the transaction that adds the booking, game
// or player, so two requests racing for the last place queue and the second sees the first. A
// transaction advisory lock, not their Customer row: that table is identity's (table ownership).

// Not frozen only so tests about something else can lift them (test/support/bookings.ts).
export const LIMITS = { payAtVenue: 2, joined: 2, hosted: 2 };

// Joining and leaving again and again (user, 2026-11-27): this many games left within the window
// means no joining for the cool-off after the last of them.
export const COOL_OFF = { leaves: 3, windowHours: 7 * 24, hours: 24 };
const HOUR_MS = 60 * 60_000;

const STILL_ON = ["PENDING", "HELD", "UNCONFIRMED", "CONFIRMED"];

const limitReached = (code: string, detail: string, limit: number) =>
  new AppError({ code, status: 409, detail, extensions: { limit } });

const lockAccount = (tx: Tx, customerId: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`player-limits:${customerId}`}, 0))`;

// Before a booking paid at the venue: fewer than two still to play.
export const checkPayAtVenue = async (tx: Tx, customerId: string, now: Date) => {
  await lockAccount(tx, customerId);
  const [row] = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "Booking" b
      JOIN "VenueCustomer" vc ON vc.id = b."customerId"
      WHERE vc."customerId" = ${customerId}::uuid
        AND b."paymentMode" = 'MANUAL' AND b."creatorId" IS NULL AND b."regularId" IS NULL
        AND b.status::text = ANY(${STILL_ON}::text[]) AND b."endsAt" > ${now}`;
  const n = row?.n ?? 0;
  if (n >= LIMITS.payAtVenue) {
    throw limitReached(
      "PAY_AT_VENUE_LIMIT",
      `You can have ${LIMITS.payAtVenue} bookings paid at the venue at a time. Play or cancel one first, or book a venue that takes payment online.`,
      LIMITS.payAtVenue,
    );
  }
};

// Before hosting a game: fewer than two hosted that haven't started.
export const checkHosted = async (tx: Tx, customerId: string, now: Date) => {
  await lockAccount(tx, customerId);
  const [row] = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "BookingListing" l
      JOIN "Booking" b ON b.id = l."bookingId"
      JOIN "VenueCustomer" vc ON vc.id = b."customerId"
      WHERE vc."customerId" = ${customerId}::uuid
        AND l.status IN ('WAITING', 'OPEN') AND l."startsAt" > ${now}`;
  const n = row?.n ?? 0;
  if (n >= LIMITS.hosted) {
    throw limitReached(
      "HOSTING_LIMIT",
      `You can host ${LIMITS.hosted} games at a time.`,
      LIMITS.hosted,
    );
  }
};

// Before joining a game: fewer than two joined that haven't ended.
export const checkJoined = async (tx: Tx, customerId: string, now: Date) => {
  await lockAccount(tx, customerId);
  const [row] = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "ListingPlayer" p
      JOIN "BookingListing" l ON l.id = p."listingId"
      JOIN "Booking" b ON b.id = l."bookingId"
      WHERE p."customerId" = ${customerId}::uuid AND p.status = 'JOINED'
        AND l.status <> 'CANCELLED' AND b.status = 'CONFIRMED' AND b."endsAt" > ${now}`;
  const n = row?.n ?? 0;
  if (n >= LIMITS.joined) {
    throw limitReached(
      "JOINING_LIMIT",
      `You can be in ${LIMITS.joined} games at a time. Play or leave one first.`,
      LIMITS.joined,
    );
  }
};

// Before joining a game: not cooling off from leaving games over and over (COOL_OFF). Only games
// the player left count: being removed by a booker isn't held against them here.
export const checkCoolOff = async (tx: Tx, customerId: string, now: Date) => {
  await lockAccount(tx, customerId);
  const since = new Date(now.getTime() - COOL_OFF.windowHours * HOUR_MS);
  const [row] = await tx.$queryRaw<{ n: number; last: Date | null }[]>`
      SELECT count(*)::int AS n, max("leftAt") AS last FROM "ListingPlayer"
      WHERE "customerId" = ${customerId}::uuid AND status = 'LEFT' AND "leftAt" > ${since}`;
  if (!row?.last || row.n < COOL_OFF.leaves) return;
  const until = new Date(row.last.getTime() + COOL_OFF.hours * HOUR_MS);
  if (until <= now) return;
  throw new AppError({
    code: "JOINING_COOL_OFF",
    status: 409,
    detail: `You've left ${row.n} games this week, so you can join again from ${until.toISOString()}.`,
    extensions: { until: until.toISOString(), leaves: row.n },
  });
};
