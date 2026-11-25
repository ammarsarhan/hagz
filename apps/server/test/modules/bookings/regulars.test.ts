import {
  Booking,
  BookingPage,
  StaffBookingDetail,
  VenueRegularDetail,
  VenueRegularList,
} from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { expireDueBookings } from "@/modules/bookings/application/expire-bookings";
import { topUpVenue } from "@/modules/bookings/application/regulars";
import { localToday, upcomingWeeks } from "@/modules/bookings/domain/regulars";
import { ALL_PERMISSIONS, instantOf } from "@/modules/venues";
import { prisma } from "@/platform/db/prisma";
import { aGround, asCustomer, asStaff, HOUR, signedIn, staffAt } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// Regulars (PR 4.5, docs/regulars.md): weekly reservations confirmed or released before a deadline.

const TZ = "Africa/Cairo";
const DAY = 24 * HOUR;

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

// Three days from today (Cairo), 20:00: the regular's first week, and the next `weeks` weeks' slots
// at 20:00 and 21:00.
const weeklyGround = async (weeks = 4) => {
  const setup = await aGround();
  const today = localToday(new Date(), TZ);
  const first = new Date(today.getTime() + 3 * DAY);
  const starts = Array.from({ length: weeks }, (_, i) => {
    const day = new Date(first.getTime() + i * 7 * DAY);
    const start = instantOf(
      { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate() },
      20,
      TZ,
    );
    if (start === null) throw new Error("No 20:00 that day.");
    return new Date(start);
  });
  await prisma.groundSlot.createMany({
    data: starts.flatMap((start) =>
      [0, 1].map((hour) => ({
        groundId: setup.ground.id,
        venueId: setup.venue.id,
        startsAt: new Date(start.getTime() + hour * HOUR),
        endsAt: new Date(start.getTime() + (hour + 1) * HOUR),
        tier: "BASE" as const,
        price: 40_000,
        scheduleVersion: 1,
      })),
    ),
  });
  const owner = await staffAt(setup.venue.id);
  const regular = (customer: object, extra: object = {}) => ({
    customer,
    groundId: setup.ground.id,
    dayOfWeek: first.getUTCDay(),
    startHour: 20,
    slotCount: 2,
    startsOn: first.toISOString().slice(0, 10),
    ...extra,
  });
  return { ...setup, owner, starts, regular };
};

const create = async (staffId: string, venueId: string, body: object) => {
  const res = await asStaff(staffId, "POST", `/venues/${venueId}/regulars`, body);
  expect(res.status).toBe(201);
  return VenueRegularDetail.parse(await res.json());
};

const detail = async (staffId: string, venueId: string, id: string) =>
  VenueRegularDetail.parse(
    await (await asStaff(staffId, "GET", `/venues/${venueId}/regulars/${id}`)).json(),
  );

const karim = { name: "Karim", phone: "+201005551234" };
const omar = { name: "Omar", phone: "+201005559999" };

describe("regulars", () => {
  it("reserves every week to the horizon, unconfirmed and paid at the venue", async () => {
    const { venue, owner, starts, regular } = await weeklyGround();
    const made = await create(owner.id, venue.id, regular(karim));
    expect(made).toMatchObject({ status: "ACTIVE", priority: 1, skippedWeeks: [] });
    expect(made.reservations.map((booking) => booking.startsAt)).toEqual(
      starts.map((start) => start.toISOString()),
    );
    expect(
      made.reservations.every((booking) => booking.status === "UNCONFIRMED" && booking.regular),
    ).toBe(true);
    const first = await prisma.booking.findFirstOrThrow({
      where: { regularId: made.id, startsAt: starts[0] },
      include: { slots: true },
    });
    expect(first).toMatchObject({ paymentMode: "MANUAL", commissionRate: 0, total: 80_000 });
    expect(first.expiresAt?.getTime()).toBe((starts[0]?.getTime() ?? 0) - 24 * HOUR);
    expect(first.slots.map((slot) => slot.status)).toEqual(["HELD", "HELD"]);
  });

  it("skips a week whose time is taken, and lists it", async () => {
    const { venue, ground, owner, starts, regular } = await weeklyGround();
    await prisma.groundSlot.updateMany({
      where: { groundId: ground.id, startsAt: starts[1] },
      data: { status: "BLOCKED" },
    });
    const made = await create(owner.id, venue.id, regular(karim));
    expect(made.reservations).toHaveLength(3);
    const skipped = localToday(starts[1] ?? new Date(), TZ)
      .toISOString()
      .slice(0, 10);
    expect(made.skippedWeeks).toEqual([skipped]);
  });

  it("confirms and releases a week by staff, and the next regular in priority takes it", async () => {
    const { venue, owner, regular } = await weeklyGround();
    const first = await create(owner.id, venue.id, regular(karim));
    const second = await create(owner.id, venue.id, regular(omar));
    expect(second.priority).toBe(2);
    expect(second.reservations).toHaveLength(0);
    expect(second.skippedWeeks).toHaveLength(4);

    const [week1, week2] = first.reservations;
    const confirmed = await asStaff(
      owner.id,
      "POST",
      `/venues/${venue.id}/reservations/${week1?.id}/confirm`,
    );
    expect(StaffBookingDetail.parse(await confirmed.json()).status).toBe("CONFIRMED");
    expect(
      (await prisma.groundSlot.findMany({ where: { bookingId: week1?.id } })).map((s) => s.status),
    ).toEqual(["BOOKED", "BOOKED"]);

    const released = await asStaff(
      owner.id,
      "POST",
      `/venues/${venue.id}/reservations/${week2?.id}/release`,
    );
    expect(StaffBookingDetail.parse(await released.json()).status).toBe("RELEASED");
    const taken = await detail(owner.id, venue.id, second.id);
    expect(taken.reservations.map((booking) => booking.startsAt)).toEqual([week2?.startsAt]);

    const again = await asStaff(
      owner.id,
      "POST",
      `/venues/${venue.id}/reservations/${week2?.id}/confirm`,
    );
    expect(again.status).toBe(409);
    const after = await detail(owner.id, venue.id, first.id);
    expect(after.reliability).toEqual({
      confirmed: 1,
      released: 1,
      missed: 0,
      cancelled: 0,
      noShows: 0,
    });
  });

  it("lets an app regular confirm or release their own week", async () => {
    const { venue, owner, regular } = await weeklyGround();
    const { token } = await signedIn("+201005551234");
    const made = await create(owner.id, venue.id, regular(karim));
    await prisma.venueCustomer.updateMany({
      where: { venueId: venue.id, phone: "+201005551234" },
      data: { customerId: (await prisma.customer.findFirstOrThrow()).id },
    });
    const [week1, week2] = made.reservations;
    const confirmed = await asCustomer(token, "POST", `/bookings/${week1?.id}/reservation/confirm`);
    expect(confirmed.status).toBe(200);
    // The booking says which weekly game it's part of; nothing's been played yet.
    expect(Booking.parse(await confirmed.json()).regular).toMatchObject({
      since: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as string,
      weeks: 0,
      played: 0,
    });
    expect(
      (await asCustomer(token, "POST", `/bookings/${week2?.id}/reservation/release`)).status,
    ).toBe(200);
    const { token: stranger } = await signedIn("+201009998877");
    expect(
      (
        await asCustomer(
          stranger,
          "POST",
          `/bookings/${made.reservations[2]?.id}/reservation/confirm`,
        )
      ).status,
    ).toBe(404);
    const statuses = await prisma.booking.findMany({
      where: { regularId: made.id },
      orderBy: { startsAt: "asc" },
      select: { status: true },
    });
    expect(statuses.map((booking) => booking.status)).toEqual([
      "CONFIRMED",
      "RELEASED",
      "UNCONFIRMED",
      "UNCONFIRMED",
    ]);
    // Upcoming shows the weekly game as its next week only; that week lists the ones after it.
    const upcoming = BookingPage.parse(
      await (await asCustomer(token, "GET", "/bookings?when=upcoming")).json(),
    );
    expect(upcoming.data.map((booking) => booking.id)).toEqual([week1?.id]);
    const next = Booking.parse(
      await (await asCustomer(token, "GET", `/bookings/${week1?.id}`)).json(),
    );
    expect(next.regular?.later.map((week) => week.status)).toEqual(["UNCONFIRMED", "UNCONFIRMED"]);
  });

  it("releases a week nobody confirmed at its deadline, counted as missed", async () => {
    const { venue, owner, starts, regular } = await weeklyGround();
    const made = await create(owner.id, venue.id, regular(karim));
    const deadline = (starts[0]?.getTime() ?? 0) - 24 * HOUR;
    await expireDueBookings({ now: () => new Date(deadline + 1) });
    const week = await prisma.booking.findFirstOrThrow({
      where: { regularId: made.id, startsAt: starts[0] },
      include: { slots: true },
    });
    expect(week.status).toBe("RELEASED");
    expect(week.slots).toHaveLength(0);
    expect((await detail(owner.id, venue.id, made.id)).reliability.missed).toBe(1);
  });

  it("pausing releases the unconfirmed weeks without counting them; resuming reserves them again", async () => {
    const { venue, owner, regular } = await weeklyGround();
    const made = await create(owner.id, venue.id, regular(karim));
    await asStaff(
      owner.id,
      "POST",
      `/venues/${venue.id}/reservations/${made.reservations[0]?.id}/confirm`,
    );
    const paused = VenueRegularDetail.parse(
      await (
        await asStaff(owner.id, "POST", `/venues/${venue.id}/regulars/${made.id}/pause`)
      ).json(),
    );
    expect(paused.status).toBe("PAUSED");
    expect(paused.reservations.map((booking) => booking.status)).toEqual(["CONFIRMED"]);
    expect(paused.reliability).toMatchObject({ released: 0, missed: 0 });

    const resumed = VenueRegularDetail.parse(
      await (
        await asStaff(owner.id, "POST", `/venues/${venue.id}/regulars/${made.id}/resume`)
      ).json(),
    );
    expect(resumed.status).toBe("ACTIVE");
    expect(resumed.reservations.map((booking) => booking.status)).toEqual([
      "CONFIRMED",
      "UNCONFIRMED",
      "UNCONFIRMED",
      "UNCONFIRMED",
    ]);

    const ended = VenueRegularDetail.parse(
      await (await asStaff(owner.id, "POST", `/venues/${venue.id}/regulars/${made.id}/end`)).json(),
    );
    expect(ended.status).toBe("ENDED");
    expect(ended.reservations.map((booking) => booking.status)).toEqual(["CONFIRMED"]);
    await topUpVenue(venue.id);
    expect((await detail(owner.id, venue.id, made.id)).reservations).toHaveLength(1);
  });

  it("a new hour releases the unconfirmed weeks and reserves the new time", async () => {
    const { venue, owner, starts, regular } = await weeklyGround();
    const made = await create(owner.id, venue.id, regular(karim));
    const res = await asStaff(owner.id, "PATCH", `/venues/${venue.id}/regulars/${made.id}`, {
      startHour: 21,
      slotCount: 1,
    });
    const changed = VenueRegularDetail.parse(await res.json());
    expect(changed.reservations.map((booking) => booking.startsAt)).toEqual(
      starts.map((start) => new Date(start.getTime() + HOUR).toISOString()),
    );
    expect(changed.reliability.released).toBe(0);
  });

  it("reorders overlapping regulars; only weeks reserved from then on follow", async () => {
    const { venue, owner, regular } = await weeklyGround();
    const first = await create(owner.id, venue.id, regular(karim));
    const second = await create(owner.id, venue.id, regular(omar));
    const res = await asStaff(owner.id, "PUT", `/venues/${venue.id}/regulars/order`, {
      regularIds: [second.id, first.id],
    });
    const list = VenueRegularList.parse(await res.json());
    expect(list.data.map((item) => [item.id, item.priority])).toEqual([
      [second.id, 1],
      [first.id, 2],
    ]);
    expect((await detail(owner.id, venue.id, first.id)).reservations).toHaveLength(4);
    // Paused, the first lets its weeks go, and the second (now first in line) takes them.
    await asStaff(owner.id, "POST", `/venues/${venue.id}/regulars/${first.id}/pause`);
    expect((await detail(owner.id, venue.id, second.id)).reservations).toHaveLength(4);
    await asStaff(owner.id, "POST", `/venues/${venue.id}/regulars/${first.id}/resume`);
    expect((await detail(owner.id, venue.id, first.id)).reservations).toHaveLength(0);
  });

  it("refuses a start date that has passed, and needs bookings: manage", async () => {
    const { venue, owner, regular } = await weeklyGround();
    const yesterday = new Date(localToday(new Date(), TZ).getTime() - DAY);
    const late = await asStaff(
      owner.id,
      "POST",
      `/venues/${venue.id}/regulars`,
      regular(karim, { startsOn: yesterday.toISOString().slice(0, 10) }),
    );
    expect(late.status).toBe(422);
    const viewer = await staffAt(venue.id, {
      role: "MEMBER",
      permissions: { ...ALL_PERMISSIONS, bookings: "view" },
    });
    expect((await asStaff(viewer.id, "GET", `/venues/${venue.id}/regulars`)).status).toBe(200);
    expect(
      (await asStaff(viewer.id, "POST", `/venues/${venue.id}/regulars`, regular(karim))).status,
    ).toBe(403);
  });
});

describe("regular weeks", () => {
  const weekly = {
    dayOfWeek: 5,
    startHour: 0,
    slotCount: 1,
    startsOn: new Date("2026-04-01T00:00:00Z"),
    endsOn: null,
  };

  it("skips a start the clocks jump over, and weeks past the deadline or the end date", () => {
    // Egypt's clocks go from 00:00 to 01:00 on the last Friday of April (2026-04-24).
    const weeks = upcomingWeeks(weekly, {
      now: new Date("2026-04-15T12:00:00Z"),
      timezone: TZ,
      horizonWeeks: 3,
      confirmationHours: 24,
      instantOf,
    });
    expect(weeks.map((week) => week.date)).toEqual(["2026-04-17", "2026-05-01"]);

    const ending = upcomingWeeks(
      { ...weekly, startHour: 20, endsOn: new Date("2026-04-24T00:00:00Z") },
      {
        now: new Date("2026-04-16T19:00:00Z"),
        timezone: TZ,
        horizonWeeks: 4,
        confirmationHours: 24,
        instantOf,
      },
    );
    expect(ending.map((week) => week.date)).toEqual(["2026-04-24"]);
  });
});
