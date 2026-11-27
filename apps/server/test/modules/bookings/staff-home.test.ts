import { Booking, StaffHome } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { staffHome } from "@/modules/bookings/application/staff-home";
import { ALL_PERMISSIONS } from "@/modules/venues";
import { venueAccess } from "@/modules/venues/application/access";
import { prisma } from "@/platform/db/prisma";
import {
  aGround,
  asStaff,
  at,
  book,
  HOUR,
  liftLimits,
  signedIn,
  staffAt,
} from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// The Home tab (Figma D21c): what needs staff on a day, then the next games and the open hours.

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

liftLimits();

const booked = async (token: string, body: object) => {
  const res = await book(token, body);
  expect(res.status).toBe(201);
  return Booking.parse(await res.json());
};

const localDay = async (marketplaceId: string, instant: Date) => {
  const { timezone } = await prisma.marketplace.findUniqueOrThrow({ where: { id: marketplaceId } });
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(instant);
};

// A request on the first hour; a confirmed game paid at the venue on the last two; the second hour
// open.
const aDay = async () => {
  const setup = await aGround({ settings: { autoConfirm: false } });
  const { token } = await signedIn();
  const request = await booked(token, { groundId: setup.ground.id, ...at(setup.hours, 0, 1) });
  const game = await booked(token, { groundId: setup.ground.id, ...at(setup.hours, 2, 4) });
  await prisma.booking.update({
    where: { id: game.id },
    data: { status: "CONFIRMED", paymentMode: "MANUAL", expiresAt: null },
  });
  const day = await localDay(setup.marketplace.id, setup.hours[0] ?? new Date());
  return { ...setup, request, game, day };
};

describe("the Home tab", () => {
  it("counts what waits on a later day, its next games, the cash to take and its open hours", async () => {
    const { venue, hours, request, game, day } = await aDay();
    const owner = await staffAt(venue.id);

    const res = await asStaff(owner.id, "GET", `/venues/${venue.id}/home?date=${day}`);
    expect(res.status).toBe(200);
    const home = StaffHome.parse(await res.json());
    expect(home.requests).toMatchObject({ count: 1, bookingId: request.id });
    expect(home.holds.count).toBe(0);
    expect(home.toMark.count).toBe(0);
    expect(home.cash).toEqual({ amount: game.total, count: 1, currency: "EGP" });
    // The request isn't a game yet.
    expect(home.next.map((one) => [one.id, one.checkedIn])).toEqual([[game.id, false]]);
    expect(home.free).toEqual([
      expect.objectContaining({
        groundName: "Pitch 1",
        startsAt: hours[1]?.toISOString(),
        endsAt: hours[2]?.toISOString(),
        price: 40_000,
      }),
    ]);
  });

  it("leaves the cash out without payments access, and needs bookings: view", async () => {
    const { venue, day } = await aDay();
    const desk = await staffAt(venue.id, {
      role: "MEMBER",
      permissions: { ...ALL_PERMISSIONS, bookings: "view", payments: "none" },
    });
    const res = await asStaff(desk.id, "GET", `/venues/${venue.id}/home?date=${day}`);
    const home = StaffHome.parse(await res.json());
    expect(home.cash).toBeNull();

    const outsider = await staffAt(venue.id, {
      role: "MEMBER",
      permissions: { ...ALL_PERMISSIONS, bookings: "none" },
    });
    expect((await asStaff(outsider.id, "GET", `/venues/${venue.id}/home?date=${day}`)).status).toBe(
      403,
    );
  });

  it("asks today about a game that ended without a check-in, until someone checks it", async () => {
    const { marketplace, venue, game } = await aDay();
    const owner = await staffAt(venue.id);
    await prisma.booking.update({ where: { id: game.id }, data: { status: "COMPLETED" } });
    const now = new Date(Date.parse(game.endsAt) + HOUR / 6);
    const clock = { now: () => now };
    const date = await localDay(marketplace.id, now);
    const access = await venueAccess(owner.id, venue.id);

    const home = await staffHome(access, { date }, clock);
    expect(home.toMark).toMatchObject({ count: 1, bookingId: game.id });
    // Over: nothing next on it, and no cash left to take for it.
    expect(home.next).toEqual([]);
    expect(home.cash).toMatchObject({ amount: 0, count: 0 });

    await prisma.booking.update({
      where: { id: game.id },
      data: { checkedInAt: now, checkedInById: owner.id },
    });
    expect((await staffHome(access, { date }, clock)).toMark.count).toBe(0);
  });
});
