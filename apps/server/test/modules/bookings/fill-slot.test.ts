import { BookingSettings, SlotCandidates } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { completeEndedBookings } from "@/modules/bookings/application/complete-bookings";
import { markBooking } from "@/modules/bookings/application/staff-decisions";
import { ALL_PERMISSIONS, instantOf } from "@/modules/venues";
import { prisma } from "@/platform/db/prisma";
import { aGround, asStaff, at, book, HOUR, signedIn, staffAt } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// Fill a slot (PR 4.6): the customers' counters, and who to call about an empty slot.

const TZ = "Africa/Cairo";
const DAY = 24 * HOUR;

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

const wall = (instant: Date) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    weekday: parts.weekday,
  };
};

// The same local weekday and hour, `weeks` weeks before.
const weeksBefore = (instant: Date, weeks: number) => {
  const local = wall(instant);
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day) - weeks * 7 * DAY);
  const start = instantOf(
    { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() },
    local.hour,
    TZ,
  );
  return new Date(start ?? 0);
};

const setup = async () => {
  const ground = await aGround();
  const owner = await staffAt(ground.venue.id);
  const customer = (name: string, phone: string) =>
    prisma.venueCustomer.create({ data: { venueId: ground.venue.id, name, phone } });
  const played = (customerId: string, startsAt: Date, status = "COMPLETED" as const) =>
    prisma.booking.create({
      data: {
        venueId: ground.venue.id,
        groundId: ground.ground.id,
        customerId,
        code: Math.random().toString(36).slice(2, 10).toUpperCase(),
        status,
        startsAt,
        endsAt: new Date(startsAt.getTime() + HOUR),
        total: 40_000,
        paymentMode: "MANUAL",
        commissionRate: 0,
        cancellationPolicy: "MODERATE",
        cancellationTiers: [],
      },
    });
  const slot = await prisma.groundSlot.findFirstOrThrow({
    where: { groundId: ground.ground.id, startsAt: ground.hours[0] },
  });
  return { ...ground, owner, customer, played, slot };
};

const candidates = async (staffId: string, venueId: string, slotId: string) => {
  const res = await asStaff(staffId, "GET", `/venues/${venueId}/slots/${slotId}/candidates`);
  expect(res.status).toBe(200);
  return SlotCandidates.parse(await res.json());
};

describe("customer counters", () => {
  it("counts games played and no-shows when games complete or are marked", async () => {
    const { venue, ground, hours } = await aGround();
    const owner = await staffAt(venue.id);
    const { token } = await signedIn();
    expect((await book(token, { groundId: ground.id, ...at(hours, 0, 1) })).status).toBe(201);
    const booking = await prisma.booking.findFirstOrThrow({ where: { venueId: venue.id } });

    await completeEndedBookings({ now: () => new Date(Date.now() + 26 * HOUR) });
    const afterGame = await prisma.venueCustomer.findUniqueOrThrow({
      where: { id: booking.customerId },
    });
    expect(afterGame).toMatchObject({ bookingCount: 1, noShowCount: 0 });
    expect(afterGame.lastBookedAt?.getTime()).toBe(hours[0]?.getTime());

    await markBooking(
      { venueId: venue.id, staffId: owner.id, role: "OWNER", permissions: ALL_PERMISSIONS },
      booking.id,
      { outcome: "NO_SHOW" },
      { now: () => new Date(Date.now() + 26 * HOUR) },
    );
    const afterMark = await prisma.venueCustomer.findUniqueOrThrow({
      where: { id: booking.customerId },
    });
    expect(afterMark).toMatchObject({ bookingCount: 0, noShowCount: 1, lastBookedAt: null });
  });
});

describe("fill a slot", () => {
  it("ranks lapsed regulars, then active ones with another slot, then everyone else", async () => {
    const { venue, owner, customer, played, slot, hours } = await setup();
    const lapsed = await customer("Lapsed", "+201000000001");
    const active = await customer("Active", "+201000000002");
    const other = await customer("Other", "+201000000003");
    const fresh = await customer("Fresh", "+201000000004");
    for (const weeks of [4, 5, 6]) await played(lapsed.id, weeksBefore(slot.startsAt, weeks));
    for (const weeks of [1, 2, 3]) await played(active.id, weeksBefore(slot.startsAt, weeks));
    await played(other.id, new Date(slot.startsAt.getTime() - 40 * DAY - 5 * HOUR));
    // The counters come from marking games; these were written directly.
    await prisma.$transaction(async (tx) => {
      const { refreshCustomerCounters } = await import("@/modules/venues");
      await refreshCustomerCounters(tx, [lapsed.id, active.id, other.id]);
    });

    const list = await candidates(owner.id, venue.id, slot.id);
    expect(list.slot).toMatchObject({ id: slot.id, status: "AVAILABLE" });
    expect(list.data.map((candidate) => [candidate.customer.name, candidate.group])).toEqual([
      ["Lapsed", "LAPSED_REGULAR"],
      ["Active", "ACTIVE_REGULAR"],
      ["Other", "OTHER"],
      ["Fresh", "OTHER"],
    ]);
    const [first, second] = list.data;
    expect(first).toMatchObject({
      gamesPlayed: 3,
      noShows: 0,
      standing: false,
      suggestedSlot: null,
    });
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    expect(first?.usual).toEqual({
      dayOfWeek: days.indexOf(wall(slot.startsAt).weekday ?? ""),
      hour: wall(slot.startsAt).hour,
    });
    // Another free slot the same local day, the nearest hour: the next one, when it's the same day.
    const next = hours[1] ?? new Date();
    const sameDay = wall(next).weekday === wall(slot.startsAt).weekday;
    if (sameDay) expect(second?.suggestedSlot?.startsAt).toBe(next.toISOString());
    expect(second?.suggestedSlot?.id).not.toBe(slot.id);
    expect(fresh.id).toBe(list.data[3]?.customer.id);
  });

  it("leaves out anyone already booked at that time, and needs customers: view", async () => {
    const { venue, owner, customer, played, slot } = await setup();
    const busy = await customer("Busy", "+201000000005");
    await played(busy.id, slot.startsAt, "CONFIRMED" as never);
    const list = await candidates(owner.id, venue.id, slot.id);
    expect(list.data.map((candidate) => candidate.customer.name)).not.toContain("Busy");

    const blind = await staffAt(venue.id, {
      role: "MEMBER",
      permissions: { ...ALL_PERMISSIONS, customers: "none" },
    });
    const denied = await asStaff(
      blind.id,
      "GET",
      `/venues/${venue.id}/slots/${slot.id}/candidates`,
    );
    expect(denied.status).toBe(403);
  });
});

describe("booking settings", () => {
  it("reads and changes the hold, regular and Fill a slot settings", async () => {
    const { venue } = await aGround();
    const owner = await staffAt(venue.id);
    const current = BookingSettings.parse(
      await (await asStaff(owner.id, "GET", `/venues/${venue.id}/booking-settings`)).json(),
    );
    expect(current).toEqual({
      staffHoldMinutes: 15,
      regularHorizon: 4,
      confirmationWindow: 24,
      lapsedAfter: 3,
      regularBookings: 3,
      regularPeriod: 8,
    });
    const res = await asStaff(owner.id, "PATCH", `/venues/${venue.id}/booking-settings`, {
      regularHorizon: 6,
      lapsedAfter: 5,
    });
    expect(BookingSettings.parse(await res.json())).toMatchObject({
      regularHorizon: 6,
      lapsedAfter: 5,
    });
    const event = await prisma.venueEvent.findFirstOrThrow({
      where: { venueId: venue.id, type: "VENUE_SETTINGS_CHANGED" },
    });
    expect(event.data).toEqual({
      changes: {
        regularHorizon: { previous: 4, next: 6 },
        lapsedAfter: { previous: 3, next: 5 },
      },
    });
    const bad = await asStaff(owner.id, "PATCH", `/venues/${venue.id}/booking-settings`, {
      regularHorizon: 13,
    });
    expect(bad.status).toBe(400);
  });
});
