import { Booking } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { completeEndedBookings } from "@/modules/bookings/application/complete-bookings";
import { markBooking } from "@/modules/bookings/application/staff-decisions";
import { ALL_PERMISSIONS } from "@/modules/venues";
import { prisma } from "@/platform/db/prisma";
import { aGround, at, book, HOUR, signedIn, staffAt, liftLimits } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// Games complete by themselves when they end (PR 4.2, user 2026-11-22); staff can change the mark
// for 24 hours after.

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

// These book a lot for one player; the at-once limits have their own tests (limits.test.ts).
liftLimits();

const booked = async (token: string, body: object) => {
  const res = await book(token, body);
  expect(res.status).toBe(201);
  return Booking.parse(await res.json());
};

const inHours = (hours: number) => ({ now: () => new Date(Date.now() + hours * HOUR) });

describe("completing ended games", () => {
  it("completes confirmed games once they end, and nothing else", async () => {
    const { ground, hours } = await aGround();
    const { token } = await signedIn();
    // [0] ends about 25 hours from now; [3] ends about 28 hours from now.
    const early = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });
    const late = await booked(token, { groundId: ground.id, ...at(hours, 3, 4) });
    const { ground: other, hours: otherHours } = await aGround({
      settings: { autoConfirm: false },
    });
    const pending = await booked(token, { groundId: other.id, ...at(otherHours, 0, 1) });

    expect(await completeEndedBookings()).toBe(0);
    expect(await completeEndedBookings(inHours(26))).toBe(1);

    const stored = await prisma.booking.findMany({
      where: { id: { in: [early.id, late.id, pending.id] } },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    const byId = new Map(stored.map((booking) => [booking.id, booking]));
    expect(byId.get(early.id)?.status).toBe("COMPLETED");
    expect(byId.get(early.id)?.events.at(-1)).toMatchObject({
      type: "COMPLETED",
      staffId: null,
      data: { from: "CONFIRMED" },
    });
    expect(byId.get(late.id)?.status).toBe("CONFIRMED");
    expect(byId.get(pending.id)?.status).toBe("PENDING");

    expect(await completeEndedBookings(inHours(26))).toBe(0);
  });

  it("lets staff change the mark until 24 hours after the end, then it's final", async () => {
    const { venue, ground, hours } = await aGround();
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    const game = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });
    await completeEndedBookings(inHours(26));
    const actor = {
      venueId: venue.id,
      staffId: owner.id,
      role: "OWNER" as const,
      permissions: ALL_PERMISSIONS,
    };

    // The game ends about 25 hours from now; the window closes about 49 hours from now.
    await markBooking(actor, game.id, { outcome: "NO_SHOW" }, inHours(48));
    await expect(
      markBooking(actor, game.id, { outcome: "COMPLETED" }, inHours(50)),
    ).rejects.toMatchObject({ code: "MARK_WINDOW_CLOSED" });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: game.id } })).status).toBe(
      "NO_SHOW",
    );
  });
});
