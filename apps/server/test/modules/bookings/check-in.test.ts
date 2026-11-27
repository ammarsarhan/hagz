import { Booking, Game, StaffBookingDetail } from "@hagz/contracts";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  bookerCode,
  manualCheckIn,
  playerCode,
  scanCheckIn,
  undoCheckIn,
} from "@/modules/bookings/application/check-in";
import { completeEndedBookings } from "@/modules/bookings/application/complete-bookings";
import { markBooking } from "@/modules/bookings/application/staff-decisions";
import { ALL_PERMISSIONS } from "@/modules/venues";
import { router } from "@/http/router";
import { prisma } from "@/platform/db/prisma";
import { aGround, asStaff, at, book, HOUR, signedIn, staffAt } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// Checking in at the venue with a QR code (2026-11-22).

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

const MINUTE = 60_000;

const call = (token: string | null, method: string, path: string, body?: unknown) =>
  router.request(`/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// A confirmed app booking, and a clock `minutes` from its kick-off.
const setup = async () => {
  const ground = await aGround();
  const owner = await staffAt(ground.venue.id);
  const booker = await signedIn();
  const res = await book(booker.token, { groundId: ground.ground.id, ...at(ground.hours, 0, 1) });
  const booking = Booking.parse(await res.json());
  const kickOff = new Date(booking.startsAt);
  const clock = (minutes: number) => ({
    now: () => new Date(kickOff.getTime() + minutes * MINUTE),
  });
  const actor = {
    venueId: ground.venue.id,
    staffId: owner.id,
    role: "OWNER" as const,
    permissions: ALL_PERMISSIONS,
  };
  return { ...ground, owner, booker, booking, kickOff, clock, actor };
};

describe("the booker's code", () => {
  it("is scanned in the window, once, and shows on both sides", async () => {
    const { booker, booking, clock, actor, owner, venue, marketplace } = await setup();
    expect(booking.checkIn).toMatchObject({
      opensAt: new Date(new Date(booking.startsAt).getTime() - 15 * MINUTE).toISOString(),
      closesAt: new Date(new Date(booking.startsAt).getTime() + 30 * MINUTE).toISOString(),
      checkedInAt: null,
    });

    const early = await bookerCode(booker.customer.id, booking.id, clock(-20));
    // Too early: the scanner is told which game, to say when it opens.
    await expect(scanCheckIn(actor, early.code, clock(-20))).rejects.toMatchObject({
      code: "CHECK_IN_CLOSED",
      extensions: {
        opensAt: new Date(new Date(booking.startsAt).getTime() - 15 * MINUTE).toISOString(),
        booking: { startsAt: booking.startsAt, ground: "Pitch 1" },
      },
    });

    const { code } = await bookerCode(booker.customer.id, booking.id, clock(-5));
    const first = await scanCheckIn(actor, code, clock(-5));
    expect(first).toMatchObject({
      bookingId: booking.id,
      already: false,
      person: { customerId: booker.customer.id, role: "BOOKER", manual: false },
      booking: {
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        timezone: marketplace.timezone,
        ground: "Pitch 1",
        bookerFirstName: booker.customer.name.split(" ")[0],
      },
    });
    expect((await scanCheckIn(actor, code, clock(-4.5))).already).toBe(true);

    const mine = Booking.parse(
      await (await call(booker.token, "GET", `/bookings/${booking.id}`)).json(),
    );
    expect(mine.checkIn?.checkedInAt).toBe(clock(-5).now().toISOString());
    const detail = StaffBookingDetail.parse(
      await (await asStaff(owner.id, "GET", `/venues/${venue.id}/bookings/${booking.id}`)).json(),
    );
    expect(detail.checkIn?.people).toEqual([
      expect.objectContaining({ customerId: booker.customer.id, role: "BOOKER", manual: false }),
    ]);
  });

  it("expires after a minute, closes 30 minutes after kick-off, and can't be forged", async () => {
    const { booker, booking, clock, actor } = await setup();
    const { code } = await bookerCode(booker.customer.id, booking.id, clock(0));
    await expect(scanCheckIn(actor, code, clock(2))).rejects.toMatchObject({
      code: "CHECK_IN_CODE_EXPIRED",
    });
    const late = await bookerCode(booker.customer.id, booking.id, clock(30));
    await expect(scanCheckIn(actor, late.code, clock(30.5))).rejects.toMatchObject({
      code: "CHECK_IN_CLOSED",
    });
    await expect(bookerCode(booker.customer.id, booking.id, clock(31))).rejects.toMatchObject({
      code: "CHECK_IN_CLOSED",
    });
    await expect(scanCheckIn(actor, `${code.slice(0, -2)}xx`, clock(0))).rejects.toMatchObject({
      code: "CHECK_IN_CODE_INVALID",
    });
    const { token } = await signedIn("+201005550011");
    const res = await call(token, "GET", `/bookings/${booking.id}/check-in-code`);
    expect(res.status).toBe(404);
  });

  it("is refused at another venue", async () => {
    const { booker, booking, clock } = await setup();
    const other = await aGround();
    const stranger = await staffAt(other.venue.id);
    const { code } = await bookerCode(booker.customer.id, booking.id, clock(0));
    const actor = {
      venueId: other.venue.id,
      staffId: stranger.id,
      role: "OWNER" as const,
      permissions: ALL_PERMISSIONS,
    };
    await expect(scanCheckIn(actor, code, clock(0))).rejects.toMatchObject({
      code: "CHECK_IN_OTHER_VENUE",
    });
  });

  it("isn't offered on a staff-entered booking", async () => {
    const { venue, ground, hours, actor } = await setup();
    const { createStaffBooking } = await import("@/modules/bookings/application/staff-entry");
    const entered = await createStaffBooking(
      actor,
      {
        groundId: ground.id,
        ...at(hours, 2, 3),
        customer: { name: "Walk-in", phone: "+201005550012" },
      } as never,
      randomUUID(),
    );
    const { staffBookingDetail } = await import("@/modules/bookings/application/staff-bookings");
    expect((await staffBookingDetail(venue.id, entered.value)).checkIn).toBeNull();
  });
});

describe("by name, undo, and marking", () => {
  it("ticks someone in by name, undoes it, and keeps a checked-in booker from being a no-show", async () => {
    const { booker, booking, clock, actor } = await setup();
    const ticked = await manualCheckIn(actor, booking.id, booker.customer.id, clock(10));
    expect(ticked.person).toMatchObject({ role: "BOOKER", manual: true });

    await expect(
      markBooking(actor, booking.id, { outcome: "NO_SHOW" }, clock(20)),
    ).rejects.toMatchObject({ code: "CHECKED_IN" });

    const stranger = await signedIn("+201005550013");
    await expect(
      manualCheckIn(actor, booking.id, stranger.customer.id, clock(10)),
    ).rejects.toMatchObject({ code: "NOT_IN_BOOKING" });

    await undoCheckIn(actor, booking.id, booker.customer.id, clock(20));
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(row).toMatchObject({ checkedInAt: null, checkedInById: null, checkedInManually: false });
    await markBooking(actor, booking.id, { outcome: "NO_SHOW" }, clock(20));
  });
});

describe("open games", () => {
  it("checks players in, charges fees for those who came, and counts reliability", async () => {
    const { owner, venue, booker, booking, clock, actor } = await setup();
    const listed = await call(booker.token, "POST", `/bookings/${booking.id}/listing`, {
      neededPlayers: 2,
    });
    const gameId = Booking.parse(await listed.json()).listing?.id ?? "";
    const one = await signedIn("+201005550001");
    const two = await signedIn("+201005550002");
    await call(one.token, "POST", `/games/${gameId}/join`);
    await call(two.token, "POST", `/games/${gameId}/join`);

    const game = Game.parse(await (await call(one.token, "GET", `/games/${gameId}`)).json());
    expect(game.me?.checkIn).toMatchObject({ checkedInAt: null });

    const { code } = await playerCode(one.customer.id, gameId, clock(0));
    expect((await scanCheckIn(actor, code, clock(0))).person).toMatchObject({
      customerId: one.customer.id,
      role: "PLAYER",
    });
    const stranger = await signedIn("+201005550003");
    await expect(playerCode(stranger.customer.id, gameId, clock(0))).rejects.toMatchObject({
      code: "NOT_JOINED",
    });

    const detail = StaffBookingDetail.parse(
      await (await asStaff(owner.id, "GET", `/venues/${venue.id}/bookings/${booking.id}`)).json(),
    );
    expect(detail.game).toMatchObject({ expectedPlayers: 2, feePlayers: 1, joinFee: 400 });
    expect(
      detail.checkIn?.people.map((person) => [person.role, person.checkedInAt !== null]),
    ).toEqual([
      ["BOOKER", false],
      ["PLAYER", true],
      ["PLAYER", false],
    ]);

    await completeEndedBookings({ now: () => new Date(Date.now() + 26 * HOUR + 3 * 24 * HOUR) });
    const view = Booking.parse(
      await (await call(booker.token, "GET", `/bookings/${booking.id}`)).json(),
    );
    expect(view.listing?.players.map((p) => [p.customerId, p.reliability])).toEqual([
      [one.customer.id, { games: 1, showedUp: 1 }],
      [two.customer.id, { games: 1, showedUp: 0 }],
    ]);
  });

  it("holds nothing against players when the venue checked in none of them", async () => {
    const { booker, booking } = await setup();
    const listed = await call(booker.token, "POST", `/bookings/${booking.id}/listing`, {
      neededPlayers: 2,
    });
    const gameId = Booking.parse(await listed.json()).listing?.id ?? "";
    const one = await signedIn("+201005550001");
    await call(one.token, "POST", `/games/${gameId}/join`);
    await completeEndedBookings({ now: () => new Date(Date.now() + 26 * HOUR + 3 * 24 * HOUR) });
    const view = Booking.parse(
      await (await call(booker.token, "GET", `/bookings/${booking.id}`)).json(),
    );
    expect(view.status).toBe("COMPLETED");
    expect(view.listing?.players[0]?.reliability).toEqual({ games: 0, showedUp: 0 });
  });

  it("forgets a player's check-in when they leave before kick-off", async () => {
    const { booker, booking, clock, actor } = await setup();
    const listed = await call(booker.token, "POST", `/bookings/${booking.id}/listing`, {
      neededPlayers: 2,
    });
    const gameId = Booking.parse(await listed.json()).listing?.id ?? "";
    const one = await signedIn("+201005550001");
    await call(one.token, "POST", `/games/${gameId}/join`);
    await manualCheckIn(actor, booking.id, one.customer.id, clock(-10));
    const { leaveGame } = await import("@/modules/bookings/application/listings");
    await leaveGame(one.customer.id, gameId, clock(-5));
    const player = await prisma.listingPlayer.findFirstOrThrow({ where: { listingId: gameId } });
    expect(player).toMatchObject({ status: "LEFT", checkedInAt: null });
  });

  it("names the player and the game when a code's player has left it", async () => {
    const { booker, booking, clock, actor } = await setup();
    const listed = await call(booker.token, "POST", `/bookings/${booking.id}/listing`, {
      neededPlayers: 2,
    });
    const gameId = Booking.parse(await listed.json()).listing?.id ?? "";
    const one = await signedIn("+201005550002");
    await call(one.token, "POST", `/games/${gameId}/join`);
    const { code } = await playerCode(one.customer.id, gameId, clock(-10));
    const { leaveGame } = await import("@/modules/bookings/application/listings");
    await leaveGame(one.customer.id, gameId, clock(-10));
    await expect(scanCheckIn(actor, code, clock(-9.5))).rejects.toMatchObject({
      code: "NOT_IN_BOOKING",
      extensions: {
        firstName: one.customer.name.split(" ")[0],
        booking: { startsAt: booking.startsAt, ground: "Pitch 1" },
      },
    });
  });
});
