import { Booking } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { expireDueBookings } from "@/modules/bookings/application/expire-bookings";
import { finishRemovals } from "@/modules/venues/application/grounds";
import { prisma } from "@/platform/db/prisma";
import { aGround, asStaff, at, book, HOUR, signedIn, staffAt } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// Deleting a ground with bookings and requests on it (user, 2026-11-27): waiting requests are
// declined, and slots freed on a ground being removed go rather than show as free hours.

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

// A venue whose bookings wait for approval, with a second ground so this one isn't its last.
const aVenue = async (settings: Record<string, unknown> = {}) => {
  const made = await aGround({ settings: { autoConfirm: false, ...settings } });
  await prisma.ground.create({
    data: {
      venueId: made.venue.id,
      sport: "FOOTBALL",
      size: "FIVE_A_SIDE",
      surface: "ARTIFICIAL_TURF",
      environment: "OUTDOOR",
      position: 1,
      basePrice: 40_000,
      translations: { create: { language: "EN", name: "Pitch 2" } },
      settings: { create: { scheduleVersion: 1, minimumSlots: 1, maximumSlots: 3 } },
    },
  });
  return { ...made, owner: await staffAt(made.venue.id) };
};

const booked = async (phone: string, body: object) => {
  const { token } = await signedIn(phone);
  const res = await book(token, body);
  expect(res.status).toBe(201);
  return Booking.parse(await res.json());
};

const statusOf = async (id: string) =>
  (await prisma.ground.findUniqueOrThrow({ where: { id } })).status;

describe("deleting a ground", () => {
  it("declines its waiting requests, and with nothing else ahead it's gone at once", async () => {
    const { venue, ground, hours, owner } = await aVenue();
    const request = await booked("+201001110001", { groundId: ground.id, ...at(hours, 0, 1) });
    expect(request.status).toBe("PENDING");

    const preview = await asStaff(
      owner.id,
      "GET",
      `/venues/${venue.id}/grounds/${ground.id}/removal`,
    );
    expect(await preview.json()).toMatchObject({ bookings: 0, requests: 1, lastEndsAt: null });

    const res = await asStaff(owner.id, "DELETE", `/venues/${venue.id}/grounds/${ground.id}`);
    expect(res.status).toBe(204);
    expect(await statusOf(ground.id)).toBe("DELETED");
    const declined = await prisma.booking.findUniqueOrThrow({
      where: { id: request.id },
      include: { cancellation: true, events: { orderBy: { createdAt: "asc" } } },
    });
    expect(declined.status).toBe("CANCELLED");
    expect(declined.cancellation).toMatchObject({ initiator: "VENUE", refundPercent: 100 });
    expect(declined.events.at(-1)).toMatchObject({
      type: "DECLINED",
      staffId: owner.id,
      data: { by: "GROUND_REMOVED" },
    });
    expect(await prisma.groundSlot.count({ where: { groundId: ground.id } })).toBe(0);
  });

  it("drops slots freed on a ground being removed instead of freeing them", async () => {
    const { venue, ground, hours, owner } = await aVenue({ paymentMode: "PLATFORM" });
    // Booked straight away and waiting for payment: a hold that keeps the ground.
    await prisma.venueSettings.update({
      where: { venueId: venue.id },
      data: { autoConfirm: true },
    });
    const held = await booked("+201001110002", { groundId: ground.id, ...at(hours, 2, 3) });
    expect(held.status).toBe("HELD");

    const res = await asStaff(owner.id, "DELETE", `/venues/${venue.id}/grounds/${ground.id}`);
    expect(res.status).toBe(204);
    expect(await statusOf(ground.id)).toBe("REMOVING");
    // Only the hold's slot is left.
    expect(await prisma.groundSlot.count({ where: { groundId: ground.id } })).toBe(1);

    // Nobody pays: the sweep lets it go, and its slot goes with it rather than showing as free.
    expect(await expireDueBookings({ now: () => new Date(Date.now() + 2 * HOUR) })).toBe(1);
    expect(await prisma.groundSlot.count({ where: { groundId: ground.id } })).toBe(0);
    expect(await finishRemovals()).toEqual({ finished: 1 });
    expect(await statusOf(ground.id)).toBe("DELETED");
  });
});
