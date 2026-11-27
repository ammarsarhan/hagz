import { Booking } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/platform/db/prisma";
import { aGround, asStaff, at, book, signedIn, staffAt } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// The warning before a ground's hours change (user, 2026-11-27): what falls in the hours it closes.

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

const TZ = "Africa/Cairo";
const local = (at: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(at);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.find((part) => part.type === "weekday")?.value ?? "",
  );
  return { weekday, hour: Number(parts.find((part) => part.type === "hour")?.value) };
};

// Every hour open, apart from those listed.
const weekWithout = (closed: { weekday: number; hour: number }[]) => ({
  days: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    hours: Array.from({ length: 24 }, (_, hour) => ({ hour, tier: "BASE" })).filter(
      ({ hour }) => !closed.some((one) => one.weekday === dayOfWeek && one.hour === hour),
    ),
  })),
});

describe("previewing a schedule change", () => {
  it("counts the bookings and the requests in the hours it closes, and saves nothing", async () => {
    const { venue, ground, hours } = await aGround({ settings: { autoConfirm: false } });
    const owner = await staffAt(venue.id);
    const request = await book((await signedIn("+201001110011")).token, {
      groundId: ground.id,
      ...at(hours, 0, 1),
    });
    expect(Booking.parse(await request.json()).status).toBe("PENDING");
    await prisma.venueSettings.update({
      where: { venueId: venue.id },
      data: { autoConfirm: true },
    });
    const confirmed = await book((await signedIn("+201001110012")).token, {
      groundId: ground.id,
      ...at(hours, 2, 3),
    });
    expect(Booking.parse(await confirmed.json()).status).toBe("CONFIRMED");

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
    const [first] = hours.map((hour) => local(hour));
    if (!first) throw new Error("No hours.");

    expect(await preview(weekWithout([]))).toEqual({ bookings: 0, requests: 0, regulars: [] });
    expect(await preview(weekWithout([first]))).toEqual({ bookings: 0, requests: 1, regulars: [] });
    expect(await preview({ days: [] })).toEqual({ bookings: 1, requests: 1, regulars: [] });
    expect(await prisma.groundSchedule.count({ where: { groundId: ground.id } })).toBe(0);
  });

  it("declines the requests in hours it closes on save, and leaves the bookings be", async () => {
    const { venue, ground, hours } = await aGround({ settings: { autoConfirm: false } });
    const owner = await staffAt(venue.id);
    const request = Booking.parse(
      await (
        await book((await signedIn("+201001110021")).token, {
          groundId: ground.id,
          ...at(hours, 0, 1),
        })
      ).json(),
    );
    await prisma.venueSettings.update({
      where: { venueId: venue.id },
      data: { autoConfirm: true },
    });
    const booked = Booking.parse(
      await (
        await book((await signedIn("+201001110022")).token, {
          groundId: ground.id,
          ...at(hours, 2, 3),
        })
      ).json(),
    );

    const res = await asStaff(
      owner.id,
      "PUT",
      `/venues/${venue.id}/grounds/${ground.id}/schedule`,
      {
        days: [],
      },
    );
    expect(res.status).toBe(200);
    const declined = await prisma.booking.findUniqueOrThrow({
      where: { id: request.id },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    expect(declined.status).toBe("CANCELLED");
    expect(declined.events.at(-1)).toMatchObject({
      type: "DECLINED",
      staffId: owner.id,
      data: { by: "SCHEDULE_CHANGED" },
    });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booked.id } })).status).toBe(
      "CONFIRMED",
    );
  });
});
