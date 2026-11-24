import { Booking } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { aGround, asCustomer, at, book, liftLimits, signedIn } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// The confirmation celebrates a player's first booking only (user, 2026-11-24).

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

liftLimits();

describe("a player's first booking", () => {
  it("is the first they make, and only that one", async () => {
    const { ground, hours } = await aGround();
    const { token } = await signedIn();
    const made = async (from: number) => {
      const res = await book(token, { groundId: ground.id, ...at(hours, from, from + 1) });
      expect(res.status).toBe(201);
      return Booking.parse(await res.json());
    };
    const first = await made(0);
    expect(first.first).toBe(true);
    const second = await made(2);
    expect(second.first).toBe(false);
    // Still the first when read again later.
    const again = Booking.parse(
      await (await asCustomer(token, "GET", `/bookings/${first.id}`)).json(),
    );
    expect(again.first).toBe(true);

    // Another player's first is theirs.
    const { token: friend } = await signedIn("+201009876543");
    const res = await book(friend, { groundId: ground.id, ...at(hours, 1, 2) });
    expect(Booking.parse(await res.json()).first).toBe(true);
  });
});
