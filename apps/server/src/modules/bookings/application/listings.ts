import {
  playersOn,
  type BookerListing,
  type Game,
  type GamePage,
  type GamesQuery,
  type ListingRequest,
  type MyGamesQuery,
  type RecordArrived,
  type StaffGame,
  type UpdateListing,
} from "@hagz/contracts";
import { Prisma } from "@/generated/prisma/client";
import type { Language } from "@/generated/prisma/enums";
import { nameIn, placeOf, type VenueAccess } from "@/modules/venues";
import { systemClock, type Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError, type ErrorStatus } from "@/platform/errors/app-error";
import { BOOKING_EVENTS } from "../domain/events";
import {
  ARRIVED_WINDOW_HOURS,
  firstName,
  joinFeeOf,
  maxNeeded,
  NO_SHOW_REPORT_HOURS,
  PHONE_HOURS_AFTER_START,
  shareOf,
} from "../domain/listings";
import { lockBooking, venueBookingNotFound } from "./booking-rows";
import { bookingNotFound } from "./my-bookings";

// Open games (PR 4.7, docs/listings.md). A player lists their confirmed app booking as needing
// players; others join from the feed or the share link. Joining, leaving and changing the number
// lock the listing row (never the booking), so two players can't take the last spot and the booker
// can't go below what's joined. The listing follows its booking through moves and closes when it's
// cancelled. Joined players don't become the venue's customers (user, 2026-11-22).

const HOUR_MS = 60 * 60_000;

const problem = (code: string, status: ErrorStatus, detail: string) =>
  new AppError({ code, status, detail });

const gameNotFound = () => problem("GAME_NOT_FOUND", 404, "There's no such game.");
const notListable = () =>
  problem(
    "BOOKING_NOT_LISTABLE",
    409,
    "Only a confirmed booking you made in the app, before it starts, can look for players.",
  );
const alreadyListed = () =>
  problem("ALREADY_LISTED", 409, "This booking is already looking for players.");
const tooMany = (max: number) =>
  new AppError({
    code: "TOO_MANY_PLAYERS",
    status: 422,
    detail: `This ground takes at most ${max} other players.`,
    extensions: { maximum: max },
  });
const belowJoined = (joined: number) =>
  new AppError({
    code: "BELOW_JOINED",
    status: 409,
    detail: "You can't ask for fewer players than have already joined.",
    extensions: { joined },
  });
const hasPlayers = () =>
  problem("GAME_HAS_PLAYERS", 409, "Remove the players who joined before turning this off.");
const notOpen = () => problem("GAME_NOT_OPEN", 409, "This game isn't taking players.");
const gameFull = () => problem("GAME_FULL", 409, "This game is full.");
const ownGame = () => problem("OWN_GAME", 409, "This is your own game.");
const alreadyJoined = () => problem("ALREADY_JOINED", 409, "You've already joined this game.");
const removed = () => problem("REMOVED_FROM_GAME", 403, "The booker removed you from this game.");
const clash = () =>
  problem("GAME_CLASH", 409, "You already have a game or a booking at this time.");
const notJoined = () => problem("NOT_JOINED", 409, "You haven't joined this game.");
const started = () => problem("GAME_STARTED", 409, "This game has already started.");
const reportClosed = () =>
  problem(
    "REPORT_WINDOW_CLOSED",
    409,
    "No-shows can be reported for 48 hours after a game that was played.",
  );
const arrivedClosed = () =>
  problem(
    "ARRIVED_WINDOW_CLOSED",
    409,
    "How many came can be recorded from kick-off until 24 hours after the end.",
  );
const tooManyArrived = (joined: number) =>
  new AppError({
    code: "MORE_THAN_JOINED",
    status: 422,
    detail: "More players can't have come than joined.",
    extensions: { joined },
  });

// ---- Inside other changes' transactions -------------------------------------------------------

interface Listable {
  id: string;
  venueId: string;
  status: string;
  total: number;
  ground: { sport: Parameters<typeof playersOn>[0]; size: Parameters<typeof playersOn>[1] };
  venue: { marketplace: { joinFeeRate: number } };
}

const listableSelect = {
  id: true,
  venueId: true,
  status: true,
  total: true,
  startsAt: true,
  creatorId: true,
  regularId: true,
  customer: { select: { customerId: true } },
  ground: { select: { sport: true, size: true } },
  venue: { select: { marketplace: { select: { joinFeeRate: true } } } },
  listing: { select: { id: true, status: true, playerCount: true } },
} as const satisfies Prisma.BookingSelect;

const terms = (booking: Listable) => {
  const share = shareOf(booking.total, playersOn(booking.ground.sport, booking.ground.size));
  return { sharePrice: share, joinFee: joinFeeOf(share, booking.venue.marketplace.joinFeeRate) };
};

const checkNeeded = (booking: Listable, needed: number) => {
  const max = maxNeeded(booking.ground.sport, booking.ground.size);
  if (needed > max) throw tooMany(max);
};

// At checkout (docs/listings.md "At checkout"): the listing waits until the booking is confirmed.
export const listAtCheckout = async (
  tx: Tx,
  bookingId: string,
  request: ListingRequest,
  startsAt: Date,
) => {
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: listableSelect,
  });
  checkNeeded(booking, request.neededPlayers);
  await tx.bookingListing.create({
    data: {
      bookingId,
      venueId: booking.venueId,
      startsAt,
      status: booking.status === "CONFIRMED" ? "OPEN" : "WAITING",
      neededPlayers: request.neededPlayers,
      note: request.note === "" ? null : (request.note ?? null),
      ...terms(booking),
    },
  });
};

// The booking was just confirmed: a listing asked for at checkout opens.
export const openWaitingListing = (tx: Tx, bookingId: string) =>
  tx.bookingListing.updateMany({
    where: { bookingId, status: "WAITING" },
    data: { status: "OPEN" },
  });

// The bookings were cancelled, declined or expired: their games end. Joined players hear in Phase 7.
export const cancelListings = (tx: Tx, bookingIds: readonly string[], now: Date) =>
  tx.bookingListing.updateMany({
    where: { bookingId: { in: [...bookingIds] }, status: { in: ["WAITING", "OPEN"] } },
    data: { status: "CANCELLED", closedAt: now },
  });

// A move or swap made a new booking: the game moves with it, players and terms kept.
export const followMove = (tx: Tx, fromId: string, toId: string, startsAt: Date) =>
  tx.bookingListing.updateMany({
    where: { bookingId: fromId },
    data: { bookingId: toId, startsAt },
  });

// ---- The booker ------------------------------------------------------------------------------

const lockListing = async (tx: Tx, listingId: string) => {
  await tx.$queryRaw`SELECT id FROM "BookingListing" WHERE id = ${listingId}::uuid FOR UPDATE`;
  return tx.bookingListing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      status: true,
      neededPlayers: true,
      playerCount: true,
      startsAt: true,
      communityId: true,
      publicAt: true,
      booking: {
        select: {
          id: true,
          status: true,
          startsAt: true,
          endsAt: true,
          customer: { select: { customerId: true } },
          ground: { select: { sport: true, size: true } },
        },
      },
    },
  });
};

// The booker's own listing, locked.
const bookersListing = async (tx: Tx, customerId: string, bookingId: string) => {
  const row = await tx.bookingListing.findFirst({ where: { bookingId }, select: { id: true } });
  if (!row) throw gameNotFound();
  const listing = await lockListing(tx, row.id);
  if (listing?.booking.customer.customerId !== customerId) throw bookingNotFound();
  return listing;
};

export const listBooking = async (
  customerId: string,
  bookingId: string,
  request: ListingRequest,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const booking = await lockBooking(tx, bookingId, null, listableSelect);
    if (booking?.customer.customerId !== customerId) throw bookingNotFound();
    // The fully-paid rule joins this check with online payments (5.2).
    if (
      booking.creatorId !== null ||
      booking.regularId !== null ||
      booking.status !== "CONFIRMED" ||
      booking.startsAt <= now
    ) {
      throw notListable();
    }
    checkNeeded(booking, request.neededPlayers);
    const note = request.note === "" ? null : (request.note ?? null);
    if (!booking.listing) {
      await tx.bookingListing.create({
        data: {
          bookingId,
          venueId: booking.venueId,
          startsAt: booking.startsAt,
          neededPlayers: request.neededPlayers,
          note,
          ...terms(booking),
        },
      });
      return;
    }
    if (booking.listing.status !== "CLOSED") throw alreadyListed();
    // Turned off with nobody joined; reopened as new.
    await tx.bookingListing.update({
      where: { id: booking.listing.id },
      data: { status: "OPEN", closedAt: null, neededPlayers: request.neededPlayers, note },
    });
  });
};

export const updateListing = async (
  customerId: string,
  bookingId: string,
  change: UpdateListing,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const listing = await bookersListing(tx, customerId, bookingId);
    if (listing.status !== "OPEN" && listing.status !== "WAITING") throw notOpen();
    if (listing.booking.startsAt <= now) throw started();
    if (change.neededPlayers !== undefined) {
      const max = maxNeeded(listing.booking.ground.sport, listing.booking.ground.size);
      if (change.neededPlayers > max) throw tooMany(max);
      if (change.neededPlayers < listing.playerCount) throw belowJoined(listing.playerCount);
    }
    await tx.bookingListing.update({
      where: { id: listing.id },
      data: {
        ...(change.neededPlayers !== undefined && { neededPlayers: change.neededPlayers }),
        ...(change.note !== undefined && { note: change.note === "" ? null : change.note }),
      },
    });
  });
};

export const closeListing = async (customerId: string, bookingId: string): Promise<void> => {
  const now = systemClock.now();
  await transaction(async (tx) => {
    const listing = await bookersListing(tx, customerId, bookingId);
    if (listing.status !== "OPEN" && listing.status !== "WAITING") throw notOpen();
    if (listing.playerCount > 0) throw hasPlayers();
    await tx.bookingListing.update({
      where: { id: listing.id },
      data: { status: "CLOSED", closedAt: now },
    });
  });
};

export const removePlayer = async (
  customerId: string,
  bookingId: string,
  playerId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const listing = await bookersListing(tx, customerId, bookingId);
    if (listing.booking.startsAt <= now) throw started();
    const { count } = await tx.listingPlayer.updateMany({
      where: { listingId: listing.id, customerId: playerId, status: "JOINED" },
      data: { status: "REMOVED", leftAt: now },
    });
    if (count === 0) throw notJoined();
    await tx.bookingListing.update({
      where: { id: listing.id },
      data: { playerCount: { decrement: 1 } },
    });
  });
};

export const reportNoShow = async (
  customerId: string,
  bookingId: string,
  playerId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const listing = await bookersListing(tx, customerId, bookingId);
    const { booking } = listing;
    if (
      booking.status !== "COMPLETED" ||
      now.getTime() > booking.endsAt.getTime() + NO_SHOW_REPORT_HOURS * HOUR_MS
    ) {
      throw reportClosed();
    }
    const { count } = await tx.listingPlayer.updateMany({
      where: { listingId: listing.id, customerId: playerId, status: "JOINED" },
      data: { noShowReportedAt: now },
    });
    if (count === 0) throw notJoined();
  });
};

// ---- Players ---------------------------------------------------------------------------------

const LIVE = ["PENDING", "HELD", "UNCONFIRMED", "CONFIRMED"] as const;

export const joinGame = async (
  customerId: string,
  listingId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const listing = await lockListing(tx, listingId);
    // Community games are for members until they go public (Phase 4b).
    if (!listing || (listing.communityId && !(listing.publicAt && listing.publicAt <= now))) {
      throw gameNotFound();
    }
    const { booking } = listing;
    if (listing.status !== "OPEN" || booking.status !== "CONFIRMED") throw notOpen();
    if (booking.startsAt <= now) throw started();
    if (booking.customer.customerId === customerId) throw ownGame();
    const existing = await tx.listingPlayer.findUnique({
      where: { listingId_customerId: { listingId, customerId } },
      select: { status: true },
    });
    if (existing?.status === "JOINED") throw alreadyJoined();
    if (existing?.status === "REMOVED") throw removed();
    if (listing.playerCount >= listing.neededPlayers) throw gameFull();
    const clashes = await tx.$queryRaw<{ n: number }[]>`
      SELECT 1 AS n FROM "ListingPlayer" p
      JOIN "BookingListing" l ON l.id = p."listingId"
      JOIN "Booking" b ON b.id = l."bookingId"
      WHERE p."customerId" = ${customerId}::uuid AND p.status = 'JOINED' AND l.id <> ${listingId}::uuid
        AND l.status = 'OPEN' AND b.status = 'CONFIRMED'
        AND b."startsAt" < ${booking.endsAt} AND b."endsAt" > ${booking.startsAt}
      UNION ALL
      SELECT 1 FROM "Booking" b
      JOIN "VenueCustomer" vc ON vc.id = b."customerId"
      WHERE vc."customerId" = ${customerId}::uuid
        AND b.status::text = ANY(${[...LIVE]}::text[])
        AND b."startsAt" < ${booking.endsAt} AND b."endsAt" > ${booking.startsAt}
      LIMIT 1`;
    if (clashes.length > 0) throw clash();
    await tx.listingPlayer.upsert({
      where: { listingId_customerId: { listingId, customerId } },
      create: { listingId, customerId, joinedAt: now },
      update: { status: "JOINED", joinedAt: now, leftAt: null, noShowReportedAt: null },
    });
    await tx.bookingListing.update({
      where: { id: listingId },
      data: { playerCount: { increment: 1 } },
    });
  });
};

export const leaveGame = async (
  customerId: string,
  listingId: string,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const listing = await lockListing(tx, listingId);
    if (!listing) throw gameNotFound();
    if (listing.booking.startsAt <= now) throw started();
    const { count } = await tx.listingPlayer.updateMany({
      where: { listingId, customerId, status: "JOINED" },
      data: { status: "LEFT", leftAt: now },
    });
    if (count === 0) throw notJoined();
    await tx.bookingListing.update({
      where: { id: listingId },
      data: { playerCount: { decrement: 1 } },
    });
  });
};

// ---- Reading ---------------------------------------------------------------------------------

const names = { translations: { select: { language: true, name: true } } } as const;

const gameSelect = {
  id: true,
  status: true,
  neededPlayers: true,
  playerCount: true,
  note: true,
  sharePrice: true,
  joinFee: true,
  booking: {
    select: {
      status: true,
      startsAt: true,
      endsAt: true,
      customer: {
        select: { name: true, customer: { select: { id: true, name: true, phone: true } } },
      },
      venue: {
        select: {
          id: true,
          slug: true,
          ...names,
          marketplace: { select: { timezone: true, currency: true } },
          location: { select: { ...names, parent: { select: names } } },
        },
      },
      ground: { select: { id: true, sport: true, size: true, ...names } },
    },
  },
  players: {
    where: { status: "JOINED" },
    orderBy: { joinedAt: "asc" },
    select: { customer: { select: { name: true } } },
  },
} as const satisfies Prisma.BookingListingSelect;

type GameRow = Prisma.BookingListingGetPayload<{ select: typeof gameSelect }>;

const presentGame = (
  row: GameRow,
  viewer: { customerId: string; status: "JOINED" | "LEFT" | "REMOVED" | null } | null,
  language: Language,
  now: Date,
  distanceKm: number | null,
): Game => {
  const { booking } = row;
  const account = booking.customer.customer;
  const isBooker = viewer !== null && account?.id === viewer.customerId;
  const joined = viewer?.status === "JOINED";
  const phoneUntil = booking.startsAt.getTime() + PHONE_HOURS_AFTER_START * HOUR_MS;
  return {
    id: row.id,
    status: row.status,
    joinable:
      row.status === "OPEN" &&
      booking.status === "CONFIRMED" &&
      booking.startsAt > now &&
      row.playerCount < row.neededPlayers,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    timezone: booking.venue.marketplace.timezone,
    currency: booking.venue.marketplace.currency,
    venue: {
      id: booking.venue.id,
      slug: booking.venue.slug,
      name: nameIn(booking.venue.translations, language),
      area: placeOf(booking.venue.location, language),
    },
    ground: {
      id: booking.ground.id,
      name: nameIn(booking.ground.translations, language),
      sport: booking.ground.sport,
      size: booking.ground.size,
    },
    distanceKm,
    neededPlayers: row.neededPlayers,
    playerCount: row.playerCount,
    spotsLeft: Math.max(0, row.neededPlayers - row.playerCount),
    note: row.note,
    booker: { firstName: firstName(account?.name ?? booking.customer.name) },
    sharePrice: row.sharePrice,
    joinFee: row.joinFee,
    me: viewer ? { booker: isBooker, status: viewer.status } : null,
    players:
      joined || isBooker ? row.players.map((player) => firstName(player.customer.name)) : null,
    bookerPhone: joined && now.getTime() < phoneUntil ? (account?.phone ?? null) : null,
  };
};

const viewerStatus = async (customerId: string | null, listingIds: readonly string[]) => {
  if (!customerId || listingIds.length === 0)
    return new Map<string, "JOINED" | "LEFT" | "REMOVED">();
  const rows = await prisma.listingPlayer.findMany({
    where: { customerId, listingId: { in: [...listingIds] } },
    select: { listingId: true, status: true },
  });
  return new Map(rows.map((row) => [row.listingId, row.status]));
};

const gamesById = async (
  ids: readonly string[],
  customerId: string | null,
  language: Language,
  now: Date,
  distances: Map<string, number | null> = new Map(),
): Promise<Game[]> => {
  const rows = await prisma.bookingListing.findMany({
    where: { id: { in: [...ids] } },
    select: gameSelect,
  });
  const statuses = await viewerStatus(customerId, ids);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    const viewer = customerId ? { customerId, status: statuses.get(id) ?? null } : null;
    return [presentGame(row, viewer, language, now, distances.get(id) ?? null)];
  });
};

export const gameView = async (
  listingId: string,
  customerId: string | null,
  language: Language,
  clock: Clock = systemClock,
): Promise<Game> => {
  const now = clock.now();
  const listing = await prisma.bookingListing.findUnique({
    where: { id: listingId },
    select: { status: true, communityId: true, publicAt: true },
  });
  if (
    !listing ||
    listing.status === "WAITING" ||
    (listing.communityId && !(listing.publicAt && listing.publicAt <= now))
  ) {
    throw gameNotFound();
  }
  const [game] = await gamesById([listingId], customerId, language, now);
  if (!game) throw gameNotFound();
  return game;
};

const encodeCursor = (startsAt: Date, distance: number, id: string) =>
  Buffer.from(JSON.stringify([startsAt.toISOString(), distance, id])).toString("base64url");

const decodeCursor = (text: string) => {
  try {
    const [startsAt, distance, id] = JSON.parse(
      Buffer.from(text, "base64url").toString(),
    ) as unknown[];
    if (typeof startsAt !== "string" || typeof distance !== "number" || typeof id !== "string") {
      throw new Error("Malformed.");
    }
    return { startsAt: new Date(startsAt), distance, id };
  } catch {
    throw problem("INVALID_CURSOR", 400, "That page link has expired. Load the list again.");
  }
};

// "Games needing players": open, not full, not started, soonest first, then nearest.
export const gamesFeed = async (
  query: GamesQuery,
  customerId: string | null,
  language: Language,
  clock: Clock = systemClock,
): Promise<GamePage> => {
  const now = clock.now();
  const point =
    query.latitude !== undefined && query.longitude !== undefined
      ? Prisma.sql`ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography`
      : null;
  const distance = point
    ? Prisma.sql`round(ST_Distance(v.coordinates, ${point}))::int`
    : Prisma.sql`0`;
  const after = query.cursor ? decodeCursor(query.cursor) : null;
  const rows = await prisma.$queryRaw<{ id: string; startsAt: Date; distance: number }[]>`
    SELECT * FROM (
      SELECT l.id, l."startsAt", ${distance} AS distance
      FROM "BookingListing" l
      JOIN "Booking" b ON b.id = l."bookingId"
      JOIN "Ground" g ON g.id = b."groundId"
      JOIN "Venue" v ON v.id = l."venueId"
      JOIN "Marketplace" m ON m.id = v."marketplaceId"
      WHERE l.status = 'OPEN' AND b.status = 'CONFIRMED' AND l."startsAt" > ${now}
        AND l."playerCount" < l."neededPlayers"
        AND (l."communityId" IS NULL OR l."publicAt" <= ${now})
        AND v.status IN ('LIVE', 'MAINTENANCE')
        ${query.sport ? Prisma.sql`AND g.sport = ${query.sport}::"GroundSport"` : Prisma.empty}
        ${query.size ? Prisma.sql`AND g.size = ${query.size}::"GroundSize"` : Prisma.empty}
        ${query.date ? Prisma.sql`AND (l."startsAt" AT TIME ZONE m.timezone)::date = ${query.date}::date` : Prisma.empty}
        ${point ? Prisma.sql`AND ST_DWithin(v.coordinates, ${point}, ${query.radius * 1000})` : Prisma.empty}
        ${
          query.area
            ? Prisma.sql`AND v."locationId" IN (
                WITH RECURSIVE tree AS (
                  SELECT id FROM "Location" WHERE id = ${query.area}::uuid
                  UNION ALL
                  SELECT l2.id FROM "Location" l2 JOIN tree ON l2."parentId" = tree.id
                )
                SELECT id FROM tree)`
            : Prisma.empty
        }
    ) AS games
    ${
      after
        ? Prisma.sql`WHERE ("startsAt", distance, id) > (${after.startsAt}, ${after.distance}, ${after.id}::uuid)`
        : Prisma.empty
    }
    ORDER BY "startsAt", distance, id
    LIMIT ${query.limit + 1}`;
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  const distances = new Map(
    page.map((row) => [row.id, point ? Math.round(row.distance / 100) / 10 : null]),
  );
  return {
    data: await gamesById(
      page.map((row) => row.id),
      customerId,
      language,
      now,
      distances,
    ),
    nextCursor:
      rows.length > query.limit && last
        ? encodeCursor(last.startsAt, last.distance, last.id)
        : null,
  };
};

// The games I've joined, upcoming soonest first or past latest first.
export const myGames = async (
  customerId: string,
  { when, limit }: MyGamesQuery,
  language: Language,
  clock: Clock = systemClock,
): Promise<Game[]> => {
  const now = clock.now();
  const rows = await prisma.listingPlayer.findMany({
    where: {
      customerId,
      status: "JOINED",
      listing: {
        booking: when === "upcoming" ? { endsAt: { gt: now } } : { endsAt: { lte: now } },
      },
    },
    orderBy: { listing: { startsAt: when === "upcoming" ? "asc" : "desc" } },
    take: limit,
    select: { listingId: true },
  });
  return gamesById(
    rows.map((row) => row.listingId),
    customerId,
    language,
    now,
  );
};

// The booker's listing on their booking, with each joined player's number and reliability.
export const bookerListing = async (bookingId: string): Promise<BookerListing | null> => {
  const listing = await prisma.bookingListing.findFirst({
    where: { bookingId },
    select: {
      id: true,
      status: true,
      neededPlayers: true,
      playerCount: true,
      note: true,
      sharePrice: true,
      joinFee: true,
      players: {
        where: { status: "JOINED" },
        orderBy: { joinedAt: "asc" },
        select: {
          customerId: true,
          joinedAt: true,
          noShowReportedAt: true,
          customer: { select: { name: true, phone: true } },
        },
      },
    },
  });
  if (!listing) return null;
  const ids = listing.players.map((player) => player.customerId);
  const records = ids.length
    ? await prisma.$queryRaw<{ customerId: string; games: number; reported: number }[]>`
        SELECT p."customerId", count(*)::int AS games,
               count(*) FILTER (WHERE p."noShowReportedAt" IS NOT NULL)::int AS reported
        FROM "ListingPlayer" p
        JOIN "BookingListing" l ON l.id = p."listingId"
        JOIN "Booking" b ON b.id = l."bookingId"
        WHERE p."customerId" = ANY(${ids}::uuid[]) AND p.status = 'JOINED' AND b.status = 'COMPLETED'
        GROUP BY p."customerId"`
    : [];
  const record = new Map(records.map((row) => [row.customerId, row]));
  return {
    id: listing.id,
    status: listing.status,
    neededPlayers: listing.neededPlayers,
    playerCount: listing.playerCount,
    note: listing.note,
    sharePrice: listing.sharePrice,
    joinFee: listing.joinFee,
    players: listing.players.map((player) => {
      const games = record.get(player.customerId)?.games ?? 0;
      return {
        customerId: player.customerId,
        firstName: firstName(player.customer.name),
        phone: player.customer.phone,
        joinedAt: player.joinedAt.toISOString(),
        reliability: { games, showedUp: games - (record.get(player.customerId)?.reported ?? 0) },
        noShowReported: player.noShowReportedAt !== null,
      };
    }),
  };
};

// The share link's game, when it's open to everyone.
export const sharedGameId = async (bookingId: string): Promise<string | null> => {
  const listing = await prisma.bookingListing.findFirst({
    where: { bookingId, status: "OPEN", communityId: null },
    select: { id: true },
  });
  return listing?.id ?? null;
};

// ---- The venue -------------------------------------------------------------------------------

export const staffGame = async (bookingId: string): Promise<StaffGame | null> => {
  const listing = await prisma.bookingListing.findFirst({
    where: { bookingId, status: "OPEN", playerCount: { gt: 0 } },
    select: {
      playerCount: true,
      joinFee: true,
      arrivedCount: true,
      arrivedAt: true,
      players: {
        where: { status: "JOINED" },
        orderBy: { joinedAt: "asc" },
        select: { customer: { select: { name: true } } },
      },
    },
  });
  if (!listing) return null;
  return {
    expectedPlayers: listing.playerCount,
    players: listing.players.map((player) => ({ firstName: firstName(player.customer.name) })),
    joinFee: listing.joinFee,
    arrivedCount: listing.arrivedCount,
    arrivedAt: listing.arrivedAt?.toISOString() ?? null,
  };
};

// Staff record how many joined players came, from kick-off until 24 hours after the end; it can be
// corrected in that time. Fewer than expected (joined less the booker's no-show reports) is noted
// on the booking, for the venue's under-recording rate.
export const recordArrived = async (
  actor: VenueAccess,
  bookingId: string,
  { count }: RecordArrived,
  clock: Clock = systemClock,
): Promise<void> => {
  const now = clock.now();
  await transaction(async (tx) => {
    const booking = await lockBooking(tx, bookingId, actor.venueId, {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      listing: { select: { id: true, playerCount: true } },
    });
    if (!booking) throw venueBookingNotFound();
    if (!booking.listing || booking.listing.playerCount === 0) throw gameNotFound();
    if (
      booking.startsAt > now ||
      now.getTime() > booking.endsAt.getTime() + ARRIVED_WINDOW_HOURS * HOUR_MS ||
      (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED")
    ) {
      throw arrivedClosed();
    }
    const listing = await lockListing(tx, booking.listing.id);
    if (!listing) throw gameNotFound();
    if (count > listing.playerCount) throw tooManyArrived(listing.playerCount);
    await tx.bookingListing.update({
      where: { id: listing.id },
      data: { arrivedCount: count, arrivedAt: now, arrivedById: actor.staffId },
    });
    const reported = await tx.listingPlayer.count({
      where: { listingId: listing.id, status: "JOINED", noShowReportedAt: { not: null } },
    });
    const expected = listing.playerCount - reported;
    await tx.bookingEvent.create({
      data: {
        bookingId: booking.id,
        type: count < expected ? BOOKING_EVENTS.GAME_SHORTFALL : BOOKING_EVENTS.ARRIVED_RECORDED,
        staffId: actor.staffId,
        data: { expected, arrived: count },
      },
    });
  });
};
