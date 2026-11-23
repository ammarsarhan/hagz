import { Booking, PlayAgain } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/platform/db/prisma";
import { aGround, asCustomer, at, book, HOUR, liftLimits, signedIn } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// Home's Play again (2026-11-23): venues played at, latest first, with the usual time there.

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

const again = async (token: string) => {
  const res = await asCustomer(token, "GET", "/bookings/again");
  expect(res.status).toBe(200);
  return PlayAgain.parse(await res.json());
};

describe("play again", () => {
  it("lists the venues played at, with the time played there twice", async () => {
    const { venue, ground, hours } = await aGround();
    const { token } = await signedIn();
    const first = await booked(token, { groundId: ground.id, ...at(hours, 0, 1) });
    const second = await booked(token, { groundId: ground.id, ...at(hours, 1, 2) });
    expect((await again(token)).data).toHaveLength(0);

    // Both played, the second a week before the first, at the same time of day.
    const weekBefore = (iso: string) => new Date(Date.parse(iso) - 7 * 24 * HOUR);
    await prisma.booking.update({ where: { id: first.id }, data: { status: "COMPLETED" } });
    await prisma.booking.update({
      where: { id: second.id },
      data: {
        status: "COMPLETED",
        startsAt: weekBefore(first.startsAt),
        endsAt: weekBefore(first.endsAt),
      },
    });
    const [entry] = (await again(token)).data;
    expect(entry?.venue.id).toBe(venue.id);
    expect(entry?.played).toBe(2);
    expect(entry?.lastPlayed).toBe(first.startsAt);
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone: entry?.venue.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(first.startsAt));
    expect(entry?.usual).toEqual({ weekday: expect.any(Number), start: local, hours: 1 });
  });

  it("has no usual time after one game", async () => {
    const { ground, hours } = await aGround();
    const { token } = await signedIn();
    const only = await booked(token, { groundId: ground.id, ...at(hours, 0, 2) });
    await prisma.booking.update({ where: { id: only.id }, data: { status: "COMPLETED" } });
    const [entry] = (await again(token)).data;
    expect(entry?.played).toBe(1);
    expect(entry?.usual).toBeNull();
  });

  it("is for signed-in players", async () => {
    const res = await asCustomer("not-a-token", "GET", "/bookings/again");
    expect(res.status).toBe(401);
  });
});
