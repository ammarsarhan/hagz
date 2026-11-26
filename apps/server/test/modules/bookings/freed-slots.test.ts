import { Booking } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/platform/db/prisma";
import { aGround, asStaff, at, book, signedIn, staffAt } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// A booking that kept its hours through a schedule or price change, then gives them back (user,
// 2026-11-27): each hour is checked against the schedule now, never freed as the old one had it.

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

const EVERY_HOUR = {
  days: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    hours: Array.from({ length: 24 }, (_, hour) => ({ hour, tier: "BASE" })),
  })),
};

const aRequest = async () => {
  const made = await aGround({ settings: { autoConfirm: false } });
  const owner = await staffAt(made.venue.id);
  const { token } = await signedIn();
  const res = await book(token, { groundId: made.ground.id, ...at(made.hours, 0, 1) });
  expect(res.status).toBe(201);
  const request = Booking.parse(await res.json());
  const path = `/venues/${made.venue.id}`;
  return { ...made, owner, request, path };
};

const decline = async (owner: string, path: string, bookingId: string) => {
  const res = await asStaff(owner, "POST", `${path}/bookings/${bookingId}/decline`, {});
  expect(res.status).toBe(200);
};

describe("hours a booking gives back", () => {
  it("take today's price when they're still open", async () => {
    const { owner, request, path, ground, hours } = await aRequest();
    const schedule = await asStaff(
      owner.id,
      "PUT",
      `${path}/grounds/${ground.id}/schedule`,
      EVERY_HOUR,
    );
    expect(schedule.status).toBe(200);
    const priced = await asStaff(owner.id, "PATCH", `${path}/grounds/${ground.id}`, {
      basePrice: 50_000,
    });
    expect(priced.status).toBe(200);

    await decline(owner.id, path, request.id);
    const slot = await prisma.groundSlot.findFirstOrThrow({
      where: { groundId: ground.id, startsAt: hours[0] },
    });
    const { scheduleVersion } = await prisma.groundSettings.findUniqueOrThrow({
      where: { groundId: ground.id },
    });
    expect(slot).toMatchObject({
      status: "AVAILABLE",
      bookingId: null,
      price: 50_000,
      scheduleVersion,
    });
  });

  it("go when the schedule has closed them", async () => {
    const { owner, request, path, ground, hours } = await aRequest();
    const closed = await asStaff(owner.id, "PUT", `${path}/grounds/${ground.id}/schedule`, {
      days: [],
    });
    expect(closed.status).toBe(200);

    await decline(owner.id, path, request.id);
    expect(
      await prisma.groundSlot.count({ where: { groundId: ground.id, startsAt: hours[0] } }),
    ).toBe(0);
  });
});
