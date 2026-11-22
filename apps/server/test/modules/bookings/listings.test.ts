import { Booking, Game, GamePage, StaffBookingDetail } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { recordArrived, reportNoShow } from "@/modules/bookings/application/listings";
import { completeEndedBookings } from "@/modules/bookings/application/complete-bookings";
import { ALL_PERMISSIONS } from "@/modules/venues";
import { router } from "@/http/router";
import { prisma } from "@/platform/db/prisma";
import { aGround, asStaff, at, book, HOUR, signedIn, staffAt } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// Open games (PR 4.7, docs/listings.md).

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

const call = (token: string | null, method: string, path: string, body?: unknown) =>
  router.request(`/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": "en",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const booked = async (token: string, body: object) => {
  const res = await book(token, body);
  expect(res.status).toBe(201);
  return Booking.parse(await res.json());
};

// A confirmed 400 EGP hour on a 5-a-side pitch, listed for `needed` players.
const listed = async (needed = 3, settings: Record<string, unknown> = {}) => {
  const setup = await aGround({ settings });
  const booker = await signedIn();
  const booking = await booked(booker.token, {
    groundId: setup.ground.id,
    ...at(setup.hours, 0, 1),
  });
  const res = await call(booker.token, "POST", `/bookings/${booking.id}/listing`, {
    neededPlayers: needed,
    note: "Friendly, all levels",
  });
  expect(res.status).toBe(200);
  const view = Booking.parse(await res.json());
  return { ...setup, booker, booking: view, gameId: view.listing?.id ?? "" };
};

const join = (token: string, gameId: string) => call(token, "POST", `/games/${gameId}/join`);

describe("listing a booking", () => {
  it("lists a confirmed app booking with the share and fee, capped by the ground", async () => {
    const { booking } = await listed();
    expect(booking.listing).toMatchObject({
      status: "OPEN",
      neededPlayers: 3,
      playerCount: 0,
      note: "Friendly, all levels",
      sharePrice: 4_000,
      joinFee: 400,
      players: [],
    });

    const { ground, hours } = await aGround();
    const other = await signedIn("+201005550009");
    const second = await booked(other.token, { groundId: ground.id, ...at(hours, 1, 2) });
    const tooMany = await call(other.token, "POST", `/bookings/${second.id}/listing`, {
      neededPlayers: 10,
    });
    expect(tooMany.status).toBe(422);
    expect(await tooMany.json()).toMatchObject({ code: "TOO_MANY_PLAYERS", maximum: 9 });
  });

  it("refuses a staff-entered booking and a second listing", async () => {
    const { booker, booking } = await listed();
    const again = await call(booker.token, "POST", `/bookings/${booking.id}/listing`, {
      neededPlayers: 2,
    });
    expect(await again.json()).toMatchObject({ code: "ALREADY_LISTED" });
    const { token: stranger } = await signedIn("+201005550008");
    const notMine = await call(stranger, "POST", `/bookings/${booking.id}/listing`, {
      neededPlayers: 2,
    });
    expect(notMine.status).toBe(404);
  });
});

describe("joining", () => {
  it("joins, shows names and the booker's number only to players, and fills up", async () => {
    const { booker, booking, gameId } = await listed(1);
    const player = await signedIn("+201005550001");
    const joined = await join(player.token, gameId);
    expect(joined.status).toBe(200);
    expect(Game.parse(await joined.json())).toMatchObject({
      playerCount: 1,
      spotsLeft: 0,
      joinable: false,
      me: { booker: false, status: "JOINED" },
      players: ["Ahmed"],
      bookerPhone: "+201001234567",
    });

    const guest = Game.parse(await (await call(null, "GET", `/games/${gameId}`)).json());
    expect(guest).toMatchObject({
      me: null,
      players: null,
      bookerPhone: null,
      booker: { firstName: "Ahmed" },
    });

    const late = await signedIn("+201005550002");
    expect(await (await join(late.token, gameId)).json()).toMatchObject({ code: "GAME_FULL" });
    expect(await (await join(booker.token, gameId)).json()).toMatchObject({ code: "OWN_GAME" });

    const mine = Booking.parse(
      await (await call(booker.token, "GET", `/bookings/${booking.id}`)).json(),
    );
    expect(mine.listing?.players).toEqual([
      expect.objectContaining({
        customerId: player.customer.id,
        phone: "+201005550001",
        reliability: { games: 0, showedUp: 0 },
        noShowReported: false,
      }),
    ]);
  });

  it("gives the last spot to exactly one of several players joining at once", async () => {
    const { gameId } = await listed(1);
    const players = await Promise.all([1, 2, 3, 4, 5].map((i) => signedIn(`+20100555010${i}`)));
    const results = await Promise.all(players.map(async (player) => join(player.token, gameId)));
    expect(results.map((res) => res.status).sort()).toEqual([200, 409, 409, 409, 409]);
    const listing = await prisma.bookingListing.findUniqueOrThrow({ where: { id: gameId } });
    expect(listing.playerCount).toBe(1);
  });

  it("lets a player leave and rejoin, but not after the booker removes them", async () => {
    const { booker, booking, gameId } = await listed();
    const player = await signedIn("+201005550001");
    await join(player.token, gameId);
    expect((await call(player.token, "POST", `/games/${gameId}/leave`)).status).toBe(200);
    expect((await join(player.token, gameId)).status).toBe(200);
    const removed = await call(
      booker.token,
      "DELETE",
      `/bookings/${booking.id}/listing/players/${player.customer.id}`,
    );
    expect(Booking.parse(await removed.json()).listing?.playerCount).toBe(0);
    const back = await join(player.token, gameId);
    expect(back.status).toBe(403);
  });

  it("refuses a game that clashes with the player's own booking", async () => {
    const { gameId } = await listed();
    const player = await signedIn("+201005550001");
    const { ground, hours } = await aGround();
    await booked(player.token, { groundId: ground.id, ...at(hours, 0, 1) });
    expect(await (await join(player.token, gameId)).json()).toMatchObject({ code: "GAME_CLASH" });
  });
});

describe("the booker's changes", () => {
  it("can't go below the joined players, or turn off a game with players", async () => {
    const { booker, booking, gameId } = await listed(2);
    const player = await signedIn("+201005550001");
    const second = await signedIn("+201005550002");
    await join(player.token, gameId);
    await join(second.token, gameId);
    const below = await call(booker.token, "PATCH", `/bookings/${booking.id}/listing`, {
      neededPlayers: 1,
    });
    expect(await below.json()).toMatchObject({ code: "BELOW_JOINED", joined: 2 });
    await call(
      booker.token,
      "DELETE",
      `/bookings/${booking.id}/listing/players/${second.customer.id}`,
    );
    const noted = await call(booker.token, "PATCH", `/bookings/${booking.id}/listing`, {
      neededPlayers: 1,
      note: null,
    });
    expect(Booking.parse(await noted.json()).listing).toMatchObject({
      neededPlayers: 1,
      note: null,
    });
    const off = await call(booker.token, "DELETE", `/bookings/${booking.id}/listing`);
    expect(await off.json()).toMatchObject({ code: "GAME_HAS_PLAYERS" });
    await call(
      booker.token,
      "DELETE",
      `/bookings/${booking.id}/listing/players/${player.customer.id}`,
    );
    const closed = await call(booker.token, "DELETE", `/bookings/${booking.id}/listing`);
    expect(Booking.parse(await closed.json()).listing?.status).toBe("CLOSED");
    const reopened = await call(booker.token, "POST", `/bookings/${booking.id}/listing`, {
      neededPlayers: 4,
    });
    expect(Booking.parse(await reopened.json()).listing).toMatchObject({
      status: "OPEN",
      neededPlayers: 4,
    });
  });
});

describe("following the booking", () => {
  it("waits for approval at checkout, then opens; a declined booking cancels it", async () => {
    const { venue, ground, hours } = await aGround({ settings: { autoConfirm: false } });
    const owner = await staffAt(venue.id);
    const booker = await signedIn();
    const pending = await booked(booker.token, {
      groundId: ground.id,
      ...at(hours, 0, 1),
      listing: { neededPlayers: 2 },
    });
    expect(pending.listing?.status).toBe("WAITING");
    expect((await call(null, "GET", `/games/${pending.listing?.id}`)).status).toBe(404);
    await asStaff(owner.id, "POST", `/venues/${venue.id}/bookings/${pending.id}/approve`);
    const open = Game.parse(
      await (await call(null, "GET", `/games/${pending.listing?.id}`)).json(),
    );
    expect(open.status).toBe("OPEN");

    const other = await booked(booker.token, {
      groundId: ground.id,
      ...at(hours, 2, 3),
      listing: { neededPlayers: 2 },
    });
    await asStaff(owner.id, "POST", `/venues/${venue.id}/bookings/${other.id}/decline`, {});
    const listing = await prisma.bookingListing.findFirstOrThrow({
      where: { bookingId: other.id },
    });
    expect(listing.status).toBe("CANCELLED");
  });

  it("moves with its booking when staff move it, players kept", async () => {
    const { venue, ground, hours, gameId } = await listed();
    const owner = await staffAt(venue.id);
    const player = await signedIn("+201005550001");
    await join(player.token, gameId);
    const listing = await prisma.bookingListing.findUniqueOrThrow({ where: { id: gameId } });
    const res = await asStaff(
      owner.id,
      "POST",
      `/venues/${venue.id}/bookings/${listing.bookingId}/move`,
      {
        groundId: ground.id,
        ...at(hours, 2, 3),
      },
    );
    expect(res.status).toBe(200);
    const moved = StaffBookingDetail.parse(await res.json());
    const game = Game.parse(await (await call(player.token, "GET", `/games/${gameId}`)).json());
    expect(game).toMatchObject({ startsAt: hours[2]?.toISOString(), playerCount: 1 });
    expect(moved.game).toMatchObject({ expectedPlayers: 1, joinFee: 400 });
  });
});

describe("the feed", () => {
  it("lists open games that aren't full, by sport", async () => {
    const { gameId } = await listed(1);
    const feed = GamePage.parse(await (await call(null, "GET", "/games?sport=FOOTBALL")).json());
    expect(feed.data.map((game) => game.id)).toEqual([gameId]);
    expect(
      GamePage.parse(await (await call(null, "GET", "/games?sport=PADEL")).json()).data,
    ).toEqual([]);
    const player = await signedIn("+201005550001");
    await join(player.token, gameId);
    expect(GamePage.parse(await (await call(null, "GET", "/games")).json()).data).toEqual([]);
    const mine = await call(player.token, "GET", "/games/mine");
    expect((await mine.json()) as { data: { id: string }[] }).toMatchObject({
      data: [{ id: gameId }],
    });
  });
});

describe("after the game", () => {
  it("staff record who came, a shortfall is noted, and the booker reports no-shows", async () => {
    const { venue, booker, gameId } = await listed(2);
    const owner = await staffAt(venue.id);
    const actor = {
      venueId: venue.id,
      staffId: owner.id,
      role: "OWNER" as const,
      permissions: ALL_PERMISSIONS,
    };
    const one = await signedIn("+201005550001");
    const two = await signedIn("+201005550002");
    await join(one.token, gameId);
    await join(two.token, gameId);
    const listing = await prisma.bookingListing.findUniqueOrThrow({ where: { id: gameId } });
    const later = { now: () => new Date(Date.now() + 26 * HOUR) };

    await expect(
      recordArrived(actor, listing.bookingId, { count: 1 }, { now: () => new Date() }),
    ).rejects.toMatchObject({ code: "ARRIVED_WINDOW_CLOSED" });
    await expect(
      recordArrived(actor, listing.bookingId, { count: 3 }, later),
    ).rejects.toMatchObject({
      code: "MORE_THAN_JOINED",
    });
    await recordArrived(actor, listing.bookingId, { count: 1 }, later);
    const events = await prisma.bookingEvent.findMany({ where: { bookingId: listing.bookingId } });
    expect(events.at(-1)).toMatchObject({
      type: "GAME_SHORTFALL",
      data: { expected: 2, arrived: 1 },
    });

    await expect(
      reportNoShow(booker.customer.id, listing.bookingId, two.customer.id, later),
    ).rejects.toMatchObject({ code: "REPORT_WINDOW_CLOSED" });
    await completeEndedBookings(later);
    await reportNoShow(booker.customer.id, listing.bookingId, two.customer.id, later);
    const view = Booking.parse(
      await (await call(booker.token, "GET", `/bookings/${listing.bookingId}`)).json(),
    );
    expect(
      view.listing?.players.map((p) => [p.customerId, p.reliability, p.noShowReported]),
    ).toEqual([
      [one.customer.id, { games: 1, showedUp: 1 }, false],
      [two.customer.id, { games: 1, showedUp: 0 }, true],
    ]);
  });
});
