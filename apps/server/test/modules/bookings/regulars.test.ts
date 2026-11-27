import {
  Booking,
  ConfirmLink,
  ReminderWeek,
  BookingPage,
  StaffBookingDetail,
  VenueRegularDetail,
  VenueRegularList,
} from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { expireDueBookings } from "@/modules/bookings/application/expire-bookings";
import { topUpVenue } from "@/modules/bookings/application/regulars";
import { finishRemovals } from "@/modules/venues/application/grounds";
import { lastWeeksOf, localToday, upcomingWeeks } from "@/modules/bookings/domain/regulars";
import { ALL_PERMISSIONS, instantOf } from "@/modules/venues";
import { router } from "@/http/router";
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

  it("lists its coming weeks, let-go ones too, and none of them as past", async () => {
    const { venue, owner, regular } = await weeklyGround();
    const made = await create(owner.id, venue.id, regular(karim));
    const [week1, week2] = made.reservations;
    await asStaff(owner.id, "POST", `/venues/${venue.id}/reservations/${week1?.id}/confirm`);
    await asStaff(owner.id, "POST", `/venues/${venue.id}/reservations/${week2?.id}/release`);
    const after = await detail(owner.id, venue.id, made.id);
    expect(after.comingWeeks.map((week) => week.state)).toEqual([
      "CONFIRMED",
      "LET_GO",
      "WAITING",
      "WAITING",
    ]);
    expect(after.lastWeeks).toEqual([]);
  });

  it("keeps a removed ground with bookings ahead until its last one ends, closed to new ones", async () => {
    const { venue, ground, owner, starts, regular } = await weeklyGround();
    // A second ground, so this one isn't the venue's last.
    await prisma.ground.create({
      data: {
        venueId: venue.id,
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
    const karimGame = await create(owner.id, venue.id, regular(karim));
    const omarGame = await create(owner.id, venue.id, regular(omar));
    expect(karimGame.reservations).toHaveLength(4);
    expect(omarGame.reservations).toHaveLength(0);
    // Karim confirms his second week; the other three wait.
    const second = karimGame.reservations[1];
    await asStaff(owner.id, "POST", `/venues/${venue.id}/reservations/${second?.id}/confirm`);
    await prisma.groundSlot.create({
      data: {
        groundId: ground.id,
        venueId: venue.id,
        startsAt: new Date((starts[0]?.getTime() ?? 0) - HOUR),
        endsAt: starts[0] ?? new Date(),
        tier: "BASE",
        price: 40_000,
        scheduleVersion: 1,
      },
    });
    const secondWeek = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(starts[1]);

    // Waiting weeks aren't counted: they're let go.
    const preview = await asStaff(
      owner.id,
      "GET",
      `/venues/${venue.id}/grounds/${ground.id}/removal`,
    );
    expect(await preview.json()).toEqual({
      bookings: 1,
      requests: 0,
      lastEndsAt: new Date((starts[1]?.getTime() ?? 0) + 2 * HOUR).toISOString(),
      regulars: [
        { id: karimGame.id, name: "Karim", lastWeek: secondWeek },
        { id: omarGame.id, name: "Omar", lastWeek: null },
      ],
    });

    const removed = await asStaff(owner.id, "DELETE", `/venues/${venue.id}/grounds/${ground.id}`);
    expect(removed.status).toBe(204);
    const kept = await prisma.ground.findUniqueOrThrow({ where: { id: ground.id } });
    expect(kept.status).toBe("REMOVING");
    // Free slots went, the waiting weeks' with them; the confirmed week's stays.
    expect(await prisma.groundSlot.count({ where: { groundId: ground.id } })).toBe(2);
    expect(await prisma.groundSlot.count({ where: { groundId: ground.id, bookingId: null } })).toBe(
      0,
    );
    const day = starts[0]?.toISOString().slice(0, 10);
    const calendar = await asStaff(owner.id, "GET", `/venues/${venue.id}/slots?date=${day}`);
    const shown = (await calendar.json()) as { grounds: { id: string; removing: boolean }[] };
    expect(shown.grounds.find((one) => one.id === ground.id)?.removing).toBe(true);

    // Karim keeps his confirmed week and ends after it; his waiting weeks went, not counted
    // against him. Omar, with none, ends now.
    const karimAfter = await detail(owner.id, venue.id, karimGame.id);
    expect(karimAfter).toMatchObject({
      status: "ACTIVE",
      endsOn: secondWeek,
      ground: { id: ground.id, deleted: true },
    });
    expect(karimAfter.reservations.map((week) => week.id)).toEqual([second?.id]);
    const letGo = await prisma.booking.findMany({
      where: { regularId: karimGame.id, status: "RELEASED" },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    expect(letGo).toHaveLength(3);
    for (const week of letGo) {
      expect(week.events.at(-1)).toMatchObject({
        type: "REGULAR_CHANGED",
        data: { reason: "GROUND_REMOVED" },
      });
    }
    expect((await detail(owner.id, venue.id, omarGame.id)).status).toBe("ENDED");

    // No new regulars on it.
    const another = await asStaff(owner.id, "POST", `/venues/${venue.id}/regulars`, {
      ...regular({ name: "Hany", phone: "+201005558888" }, { startHour: 22, slotCount: 1 }),
    });
    expect(another.status).toBe(409);
    expect(await another.json()).toMatchObject({ code: "GROUND_UNAVAILABLE" });
    expect(await finishRemovals()).toEqual({ finished: 0 });
  });

  it("previews a schedule change: the regulars whose weekly time it closes, and their weeks", async () => {
    const { venue, ground, owner, starts, regular } = await weeklyGround();
    const made = await create(owner.id, venue.id, regular(karim));
    const weekday = regular(karim).dayOfWeek;
    const week = (closed: number | null) => ({
      days: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        hours: Array.from({ length: 24 }, (_, hour) => ({ hour, tier: "BASE" })).filter(
          ({ hour }) => !(dayOfWeek === weekday && hour === closed),
        ),
      })),
    });
    const preview = async (body: object) => {
      const res = await asStaff(
        owner.id,
        "POST",
        `/venues/${venue.id}/grounds/${ground.id}/schedule/preview`,
        body,
      );
      expect(res.status).toBe(200);
      return res.json();
    };

    expect(await preview(week(null))).toEqual({ bookings: 0, requests: 0, regulars: [] });
    // Karim confirms his third week; the others wait.
    const third = made.reservations[2];
    await asStaff(owner.id, "POST", `/venues/${venue.id}/reservations/${third?.id}/confirm`);
    // Closing just the second hour of the game closes it too. Only the confirmed week goes ahead:
    // the waiting ones are let go.
    const last = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(starts[2]);
    expect(await preview(week(21))).toEqual({
      bookings: 1,
      requests: 0,
      regulars: [{ id: made.id, name: "Karim", lastWeek: last }],
    });
    // Nothing was saved.
    expect(await prisma.groundSchedule.count({ where: { groundId: ground.id } })).toBe(0);

    // Saved: the regular lets its waiting weeks go, keeps the confirmed one and ends after it.
    const saved = await asStaff(
      owner.id,
      "PUT",
      `/venues/${venue.id}/grounds/${ground.id}/schedule`,
      week(21),
    );
    expect(saved.status).toBe(200);
    const after = await detail(owner.id, venue.id, made.id);
    expect(after).toMatchObject({ status: "ACTIVE", endsOn: last });
    expect(after.reservations.map((one) => one.id)).toEqual([third?.id]);
    const letGo = await prisma.booking.findMany({
      where: { regularId: made.id, status: "RELEASED" },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    expect(letGo).toHaveLength(3);
    for (const one of letGo) {
      expect(one.events.at(-1)).toMatchObject({
        type: "REGULAR_CHANGED",
        data: { reason: "SCHEDULE_CHANGED" },
      });
    }
    // A regular with no week reserved ends at once.
    const omarGame = await create(
      owner.id,
      venue.id,
      regular(omar, { startHour: 18, slotCount: 1 }),
    );
    expect(omarGame.reservations).toHaveLength(0);
    const evening = await asStaff(
      owner.id,
      "PUT",
      `/venues/${venue.id}/grounds/${ground.id}/schedule`,
      {
        days: week(21).days.map((day) => ({
          ...day,
          hours: day.hours.filter(({ hour }) => !(day.dayOfWeek === weekday && hour === 18)),
        })),
      },
    );
    expect(evening.status).toBe(200);
    expect((await detail(owner.id, venue.id, omarGame.id)).status).toBe("ENDED");
  });

  it("never gives one customer two regulars sharing an hour on a ground", async () => {
    const { venue, owner, regular } = await weeklyGround();
    const first = await create(owner.id, venue.id, regular(karim));
    const twice = await asStaff(owner.id, "POST", `/venues/${venue.id}/regulars`, {
      ...regular(karim, { startHour: 21, slotCount: 1 }),
    });
    expect(twice.status).toBe(409);
    expect(await twice.json()).toMatchObject({ code: "REGULAR_OVERLAPS" });
    // Someone else waits in line behind; the hour after is Karim's to have too.
    await create(owner.id, venue.id, regular(omar));
    const after = await create(owner.id, venue.id, regular(karim, { startHour: 22, slotCount: 1 }));
    const moved = await asStaff(owner.id, "PATCH", `/venues/${venue.id}/regulars/${after.id}`, {
      startHour: 21,
    });
    expect(moved.status).toBe(409);
    // Once the first has ended, its hours are free for another.
    await asStaff(owner.id, "POST", `/venues/${venue.id}/regulars/${first.id}/end`);
    await create(owner.id, venue.id, regular(karim, { startHour: 21, slotCount: 1 }));
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

  it("a new day leaves out a week that already has a confirmed game, moved or not", async () => {
    const { venue, owner, regular, starts } = await weeklyGround();
    const groundId = (await prisma.groundSlot.findFirstOrThrow({ where: { venueId: venue.id } }))
      .groundId;
    // The day after each week's game is free too.
    await prisma.groundSlot.createMany({
      data: starts.map((start) => ({
        groundId,
        venueId: venue.id,
        startsAt: new Date(start.getTime() + DAY),
        endsAt: new Date(start.getTime() + DAY + HOUR),
        tier: "BASE" as const,
        price: 40_000,
        scheduleVersion: 1,
      })),
    });
    const made = await create(owner.id, venue.id, regular(karim));
    const week1 = made.reservations[0];
    await asStaff(owner.id, "POST", `/venues/${venue.id}/reservations/${week1?.id}/confirm`);

    const res = await asStaff(owner.id, "PATCH", `/venues/${venue.id}/regulars/${made.id}`, {
      dayOfWeek: (made.dayOfWeek + 1) % 7,
      slotCount: 1,
    });
    const changed = VenueRegularDetail.parse(await res.json());
    const [first, ...rest] = starts;
    // The confirmed week stays where it was, and its week isn't reserved again on the new day.
    expect(changed.reservations.map((booking) => [booking.status, booking.startsAt])).toEqual([
      ["CONFIRMED", first?.toISOString()],
      ...rest.map((start) => ["UNCONFIRMED", new Date(start.getTime() + DAY).toISOString()]),
    ]);
    expect(changed.skippedWeeks).toEqual([]);
  });

  it("a confirmed week moved off the time goes to the regular next in line", async () => {
    const { venue, owner, regular, ground } = await weeklyGround();
    const karimGame = await create(owner.id, venue.id, regular(karim, { slotCount: 1 }));
    const omarGame = await create(owner.id, venue.id, regular(omar, { slotCount: 1 }));
    expect(omarGame.reservations).toHaveLength(0);
    const week = karimGame.reservations[0];
    await asStaff(owner.id, "POST", `/venues/${venue.id}/reservations/${week?.id}/confirm`);
    // Karim's first week moves an hour later; 8pm that week is Omar's now.
    const later = new Date(Date.parse(week?.startsAt ?? "") + HOUR);
    const res = await asStaff(owner.id, "POST", `/venues/${venue.id}/bookings/${week?.id}/move`, {
      groundId: ground.id,
      startsAt: later.toISOString(),
      endsAt: new Date(later.getTime() + HOUR).toISOString(),
    });
    expect(res.status).toBe(200);
    expect(
      (await detail(owner.id, venue.id, omarGame.id)).reservations.map((booking) => [
        booking.status,
        booking.startsAt,
      ]),
    ).toEqual([["UNCONFIRMED", week?.startsAt]]);
    // Karim keeps his moved game, and doesn't take 8pm back that week.
    expect(
      (await detail(owner.id, venue.id, karimGame.id)).reservations.map((booking) => [
        booking.status,
        booking.startsAt,
      ])[0],
    ).toEqual(["CONFIRMED", later.toISOString()]);
  });

  it("a waiting week moved takes the deadline of its new time", async () => {
    const { venue, owner, regular, ground } = await weeklyGround();
    const made = await create(owner.id, venue.id, regular(karim, { slotCount: 1 }));
    const week = made.reservations[1];
    const later = new Date(Date.parse(week?.startsAt ?? "") + HOUR);
    const res = await asStaff(owner.id, "POST", `/venues/${venue.id}/bookings/${week?.id}/move`, {
      groundId: ground.id,
      startsAt: later.toISOString(),
      endsAt: new Date(later.getTime() + HOUR).toISOString(),
    });
    expect(res.status).toBe(200);
    const moved = await prisma.booking.findFirstOrThrow({
      where: { regularId: made.id, startsAt: later },
    });
    expect(moved.status).toBe("UNCONFIRMED");
    // The venue's 24 hours before the new kick-off, not the old one's.
    expect(moved.expiresAt?.getTime()).toBe(later.getTime() - 24 * HOUR);
  });

  it("takes the customer's own hold or booking at its time as that week, not skipping it", async () => {
    const { venue, owner, regular, starts, ground } = await weeklyGround();
    const [first, second, third] = starts;
    const at = (start: Date | undefined) => ({
      groundId: ground.id,
      startsAt: start?.toISOString(),
      endsAt: new Date((start?.getTime() ?? 0) + 2 * HOUR).toISOString(),
      customer: karim,
    });
    const hold = async (start: Date | undefined) => {
      const res = await asStaff(owner.id, "POST", `/venues/${venue.id}/holds`, at(start));
      expect(res.status).toBe(201);
      return StaffBookingDetail.parse(await res.json());
    };
    // Karim's hold on the first week; his hold on the second, confirmed; Omar's hold on the third.
    const held = await hold(first);
    const booked = await hold(second);
    await asStaff(owner.id, "POST", `/venues/${venue.id}/holds/${booked.id}/confirm`);
    const res = await asStaff(owner.id, "POST", `/venues/${venue.id}/holds`, {
      ...at(third),
      customer: omar,
    });
    expect(res.status).toBe(201);

    const made = await create(owner.id, venue.id, regular(karim));
    expect(made.reservations.map((booking) => [booking.id, booking.status])).toEqual([
      [held.id, "UNCONFIRMED"],
      [booked.id, "CONFIRMED"],
      [expect.any(String), "UNCONFIRMED"],
    ]);
    // The hold waits for a confirm by the regular's deadline now, not the hold's.
    expect(Date.parse(made.reservations[0]?.expiresAt ?? "")).toBe(
      (first?.getTime() ?? 0) - 24 * HOUR,
    );
    // Omar's hold is someone else's: that week is skipped as taken.
    expect(made.skippedWeeks).toEqual([third?.toISOString().slice(0, 10)]);
    expect((await prisma.bookingEvent.findMany({ where: { type: "REGULAR_JOINED" } })).length).toBe(
      2,
    );
  });

  it("lines up a regular that overlaps another in part, and lets it go first", async () => {
    const { venue, owner, regular } = await weeklyGround();
    // Karim plays 8–10pm; Omar wants just 9–10pm, so he's in line behind Karim, with no week yet.
    const karimGame = await create(owner.id, venue.id, regular(karim));
    const omarGame = await create(
      owner.id,
      venue.id,
      regular(omar, { startHour: 21, slotCount: 1 }),
    );
    expect(omarGame.reservations).toHaveLength(0);
    const list = VenueRegularList.parse(
      await (await asStaff(owner.id, "GET", `/venues/${venue.id}/regulars`)).json(),
    );
    expect(list.data.map((item) => item.id)).toEqual([karimGame.id, omarGame.id]);
    // Omar first now; Karim pauses, and his weeks go to Omar.
    const res = await asStaff(owner.id, "PUT", `/venues/${venue.id}/regulars/order`, {
      regularIds: [omarGame.id, karimGame.id],
    });
    expect(res.status).toBe(200);
    await asStaff(owner.id, "POST", `/venues/${venue.id}/regulars/${karimGame.id}/pause`);
    expect((await detail(owner.id, venue.id, omarGame.id)).reservations).toHaveLength(4);
    // Back, Karim can't have 8–10pm while Omar keeps 9–10pm: he waits in line now.
    await asStaff(owner.id, "POST", `/venues/${venue.id}/regulars/${karimGame.id}/resume`);
    expect((await detail(owner.id, venue.id, karimGame.id)).reservations).toHaveLength(0);
  });

  it("reorders overlapping regulars; waiting weeks go to the new first, confirmed ones stay", async () => {
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
    // Karim's waiting weeks went to Omar, first now.
    expect((await detail(owner.id, venue.id, first.id)).reservations).toHaveLength(0);
    expect((await detail(owner.id, venue.id, second.id)).reservations).toHaveLength(4);
    // A week Omar confirms stays his when the order flips back; his waiting weeks go to Karim.
    const [kept] = (await detail(owner.id, venue.id, second.id)).reservations;
    await asStaff(owner.id, "POST", `/venues/${venue.id}/reservations/${kept?.id}/confirm`);
    await asStaff(owner.id, "PUT", `/venues/${venue.id}/regulars/order`, {
      regularIds: [first.id, second.id],
    });
    expect(
      (await detail(owner.id, venue.id, second.id)).reservations.map((booking) => booking.id),
    ).toEqual([kept?.id]);
    expect((await detail(owner.id, venue.id, first.id)).reservations).toHaveLength(3);
    // Paused, Karim lets his weeks go, and Omar (next in line) takes them.
    await asStaff(owner.id, "POST", `/venues/${venue.id}/regulars/${first.id}/pause`);
    expect((await detail(owner.id, venue.id, second.id)).reservations).toHaveLength(4);
    // Back, Karim is first again: Omar's waiting weeks come back to him; Omar's confirmed one stays.
    await asStaff(owner.id, "POST", `/venues/${venue.id}/regulars/${first.id}/resume`);
    expect((await detail(owner.id, venue.id, first.id)).reservations).toHaveLength(3);
    expect(
      (await detail(owner.id, venue.id, second.id)).reservations.map((booking) => booking.id),
    ).toEqual([kept?.id]);
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

describe("booking settings on regulars already set", () => {
  const change = async (staffId: string, venueId: string, body: object) => {
    const res = await asStaff(staffId, "PATCH", `/venues/${venueId}/booking-settings`, body);
    expect(res.status).toBe(200);
  };
  const weeks = (regularId: string) =>
    prisma.booking.findMany({
      where: { regularId },
      orderBy: { startsAt: "asc" },
      select: { status: true, startsAt: true, expiresAt: true },
    });

  it("a longer confirmation window moves each waiting week's deadline, unless that has passed", async () => {
    const { venue, owner, starts, regular } = await weeklyGround();
    const made = await create(owner.id, venue.id, regular(karim));
    // The first week kicks off in about three days: 96 hours before it has already gone.
    await change(owner.id, venue.id, { confirmationWindow: 96 });
    const after = await weeks(made.id);
    expect(after.map((week) => week.status)).toEqual(Array(4).fill("UNCONFIRMED"));
    expect(after.map((week) => week.expiresAt?.getTime())).toEqual(
      starts.map((start, i) => start.getTime() - (i === 0 ? 24 : 96) * HOUR),
    );
  });

  it("a shorter confirmation window gives every waiting week the later deadline", async () => {
    const { venue, owner, starts, regular } = await weeklyGround();
    const made = await create(owner.id, venue.id, regular(karim));
    await change(owner.id, venue.id, { confirmationWindow: 12 });
    expect((await weeks(made.id)).map((week) => week.expiresAt?.getTime())).toEqual(
      starts.map((start) => start.getTime() - 12 * HOUR),
    );
  });

  it("a shorter horizon lets go of the waiting weeks beyond it; confirmed ones stay", async () => {
    const { venue, owner, starts, regular } = await weeklyGround();
    const made = await create(owner.id, venue.id, regular(karim));
    const last = made.reservations[3];
    const confirmed = await asStaff(
      owner.id,
      "POST",
      `/venues/${venue.id}/reservations/${last?.id}/confirm`,
    );
    expect(confirmed.status).toBe(200);

    await change(owner.id, venue.id, { regularHorizon: 2 });
    expect((await weeks(made.id)).map((week) => [week.status, week.startsAt])).toEqual([
      ["UNCONFIRMED", starts[0]],
      ["UNCONFIRMED", starts[1]],
      ["RELEASED", starts[2]],
      ["CONFIRMED", starts[3]],
    ]);
    // Its slots are back on sale, and it isn't counted against the regular.
    const third = await prisma.booking.findFirstOrThrow({
      where: { regularId: made.id, startsAt: starts[2] },
      include: { slots: true, events: true },
    });
    expect(third.slots).toHaveLength(0);
    expect(third.events.at(-1)).toMatchObject({
      type: "REGULAR_CHANGED",
      data: { reason: "HORIZON" },
    });
    expect((await detail(owner.id, venue.id, made.id)).reliability.released).toBe(0);
  });

  it("a longer horizon reserves the new weeks straight away", async () => {
    const { venue, owner, starts, regular } = await weeklyGround(6);
    const made = await create(owner.id, venue.id, regular(karim));
    expect(made.reservations).toHaveLength(4);
    await change(owner.id, venue.id, { regularHorizon: 6 });
    expect((await weeks(made.id)).map((week) => week.startsAt)).toEqual(starts);
  });
});

describe("confirm links", () => {
  const copy = (staffId: string, venueId: string, bookingId: string) =>
    asStaff(staffId, "POST", `/venues/${venueId}/reservations/${bookingId}/link`);
  const tokenOf = async (res: Response) => {
    expect(res.status).toBe(201);
    const link = ConfirmLink.parse(await res.json());
    return { link, token: decodeURIComponent(new URL(link.url).hash.replace("#token=", "")) };
  };
  const open = (action: "week" | "confirm" | "release", token: string) =>
    router.request(`/v1/confirm-links/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": "en" },
      body: JSON.stringify({ token }),
    });
  const week = async (res: Response) => {
    expect(res.status).toBe(200);
    return ReminderWeek.parse(await res.json());
  };

  it("staff copy a link that confirms the week once, without signing in", async () => {
    const { venue, owner, starts, regular } = await weeklyGround();
    const made = await create(owner.id, venue.id, regular(karim));
    const first = made.reservations[0];
    const { link, token } = await tokenOf(await copy(owner.id, venue.id, first?.id ?? ""));
    // Arabic unless the regular has the app in English; the token only in the fragment.
    expect(new URL(link.url).pathname).toBe("/ar/regular");
    expect(link.expiresAt).toBe(new Date((starts[0]?.getTime() ?? 0) - 24 * HOUR).toISOString());
    expect(await prisma.reminderToken.count({ where: { tokenHash: token } })).toBe(0);

    expect(await week(await open("week", token))).toMatchObject({
      state: "WAITING",
      code: first?.code,
      name: "Karim",
      startsAt: starts[0]?.toISOString(),
      ground: { sport: "FOOTBALL" },
    });
    expect((await week(await open("confirm", token))).state).toBe("CONFIRMED");
    const confirmed = await prisma.booking.findUniqueOrThrow({
      where: { id: first?.id ?? "" },
      include: { events: true, slots: true },
    });
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.slots.map((slot) => slot.status)).toEqual(["BOOKED", "BOOKED"]);
    expect(confirmed.events.at(-1)).toMatchObject({
      type: "CONFIRMED",
      data: { by: "CUSTOMER", via: "LINK" },
    });
    // Used up: it can't let the week go now, and says how the week stands.
    expect((await week(await open("release", token))).state).toBe("CONFIRMED");
    expect((await detail(owner.id, venue.id, made.id)).reliability.confirmed).toBe(1);
  });

  it("lets the week go through a link, and the next regular in line gets it", async () => {
    const { venue, owner, starts, regular } = await weeklyGround();
    const first = await create(owner.id, venue.id, regular(karim));
    const second = await create(owner.id, venue.id, regular(omar));
    const { token } = await tokenOf(
      await copy(owner.id, venue.id, first.reservations[0]?.id ?? ""),
    );
    expect((await week(await open("release", token))).state).toBe("RELEASED");
    const taken = await prisma.booking.findFirstOrThrow({
      where: { regularId: second.id, startsAt: starts[0] },
    });
    expect(taken.status).toBe("UNCONFIRMED");
  });

  it("every link for a week stops working once it's answered, and at its deadline", async () => {
    const { venue, owner, regular } = await weeklyGround();
    const made = await create(owner.id, venue.id, regular(karim));
    const [first, second] = made.reservations;
    const one = await tokenOf(await copy(owner.id, venue.id, first?.id ?? ""));
    const two = await tokenOf(await copy(owner.id, venue.id, first?.id ?? ""));
    expect(one.token).not.toBe(two.token);
    await week(await open("confirm", one.token));
    expect((await week(await open("release", two.token))).state).toBe("CONFIRMED");
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: first?.id ?? "" } })).status,
    ).toBe("CONFIRMED");

    const late = await tokenOf(await copy(owner.id, venue.id, second?.id ?? ""));
    await prisma.booking.update({
      where: { id: second?.id ?? "" },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    expect((await week(await open("confirm", late.token))).state).toBe("MISSED");
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: second?.id ?? "" } })).status,
    ).toBe("UNCONFIRMED");
    // Still missed once the sweep has let it go: nobody said "not this week".
    await expireDueBookings();
    expect((await week(await open("week", late.token))).state).toBe("MISSED");
  });

  it("says the venue changed the week when staff let it go or end the regular", async () => {
    const { venue, owner, regular } = await weeklyGround();
    const made = await create(owner.id, venue.id, regular(karim));
    const [first, second] = made.reservations;
    const one = await tokenOf(await copy(owner.id, venue.id, first?.id ?? ""));
    const two = await tokenOf(await copy(owner.id, venue.id, second?.id ?? ""));
    await asStaff(owner.id, "POST", `/venues/${venue.id}/reservations/${first?.id}/release`);
    expect((await week(await open("week", one.token))).state).toBe("CHANGED");
    await asStaff(owner.id, "POST", `/venues/${venue.id}/regulars/${made.id}/end`);
    expect((await week(await open("week", two.token))).state).toBe("CHANGED");
  });

  it("follows a longer Confirm by set after the link was copied", async () => {
    const { venue, owner, regular } = await weeklyGround();
    const made = await create(owner.id, venue.id, regular(karim));
    const week1 = made.reservations[0];
    const link = await tokenOf(await copy(owner.id, venue.id, week1?.id ?? ""));
    // The link was made to last until the old deadline, now passed; the week's own is still ahead.
    await prisma.reminderToken.updateMany({
      where: { bookingId: week1?.id ?? "" },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    expect((await week(await open("confirm", link.token))).state).toBe("CONFIRMED");
  });

  it("is for a coming week, confirmed or waiting, at staff's own venue; unknown links are refused", async () => {
    const { venue, owner, regular } = await weeklyGround();
    const made = await create(owner.id, venue.id, regular(karim));
    const [first, , third] = made.reservations;
    // The very next week, already confirmed: its link says so, with nothing left to answer.
    await asStaff(owner.id, "POST", `/venues/${venue.id}/reservations/${first?.id}/confirm`);
    const confirmed = await tokenOf(await copy(owner.id, venue.id, first?.id ?? ""));
    expect((await week(await open("week", confirmed.token))).state).toBe("CONFIRMED");
    expect((await week(await open("release", confirmed.token))).state).toBe("CONFIRMED");

    await asStaff(owner.id, "POST", `/venues/${venue.id}/reservations/${third?.id}/release`);
    const released = await copy(owner.id, venue.id, third?.id ?? "");
    expect(released.status).toBe(409);
    expect(await released.json()).toMatchObject({ code: "RESERVATION_NOT_WAITING" });

    const viewer = await staffAt(venue.id, {
      role: "MEMBER",
      permissions: { ...ALL_PERMISSIONS, bookings: "view" },
    });
    expect((await copy(viewer.id, venue.id, made.reservations[1]?.id ?? "")).status).toBe(403);

    const unknown = await open("week", "x".repeat(43));
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({ code: "CONFIRM_LINK_NOT_FOUND" });
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

describe("a regular's last weeks", () => {
  it("lists its settled weeks, oldest first, the last ten", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    // Tuesdays at 8pm Cairo (18:00Z), going back from the 24th.
    const week = (back: number) => new Date(Date.UTC(2026, 10, 24 - 7 * back, 18));
    const row = (
      back: number,
      status: string,
      confirmed: boolean,
      releasedBy: "STAFF" | "CUSTOMER" | "DEADLINE" | "REGULAR" | null = null,
    ) => ({ startsAt: week(back), status: status as never, confirmed, releasedBy });
    const rows = [
      row(-1, "UNCONFIRMED", false), // next week: not settled
      row(0, "COMPLETED", true),
      row(1, "NO_SHOW", true),
      row(2, "RELEASED", false, "CUSTOMER"),
      row(3, "RELEASED", false, "DEADLINE"),
      row(4, "RELEASED", false, "REGULAR"), // the regular paused: not counted
      row(5, "CANCELLED", true),
      ...Array.from({ length: 8 }, (_, index) => row(6 + index, "COMPLETED", true)),
    ];
    const weeks = lastWeeksOf(rows, now, TZ);
    expect(weeks).toHaveLength(10);
    expect(weeks.slice(-5)).toEqual([
      { date: "2026-10-20", outcome: "LET_GO" },
      { date: "2026-11-03", outcome: "NOT_ANSWERED" },
      { date: "2026-11-10", outcome: "LET_GO" },
      { date: "2026-11-17", outcome: "NO_SHOW" },
      { date: "2026-11-24", outcome: "PLAYED" },
    ]);
    expect(weeks[0]).toEqual({ date: "2026-09-15", outcome: "PLAYED" });
  });
});
