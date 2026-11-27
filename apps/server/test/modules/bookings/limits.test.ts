import { Booking } from "@hagz/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { LIMITS } from "@/modules/bookings/application/limits";
import { joinGame } from "@/modules/bookings/application/listings";
import { aGround, at, book, signedIn } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// What a player can have on at once where nothing is paid up front: two bookings paid at the
// venue, two games joined, two games hosted (application/limits.ts).

const HOUR = 60 * 60_000;
const kept = { ...LIMITS };
beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});
afterEach(() => {
  Object.assign(LIMITS, kept);
});

const call = (token: string, method: string, path: string, body?: unknown) =>
  router.request(`/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": "en",
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const codeOf = async (res: Response) => ((await res.json()) as { code?: string }).code;

// A booked hour, opened to players as a game; its id.
const hosted = async (token: string, groundId: string, hours: Date[], hour: number) => {
  const res = await book(token, { groundId, ...at(hours, hour, hour + 1) });
  expect(res.status).toBe(201);
  const booking = Booking.parse(await res.json());
  const listed = await call(token, "POST", `/bookings/${booking.id}/listing`, {
    neededPlayers: 3,
  });
  const id = listed.ok ? Booking.parse(await listed.clone().json()).listing?.id : undefined;
  return { status: listed.status, res: listed, id };
};

describe("bookings paid at the venue", () => {
  it("allows two still to play, and no more; prepaid ones aren't limited", async () => {
    const { ground, hours } = await aGround();
    const player = await signedIn();
    expect((await book(player.token, { groundId: ground.id, ...at(hours, 0, 1) })).status).toBe(
      201,
    );
    expect((await book(player.token, { groundId: ground.id, ...at(hours, 1, 2) })).status).toBe(
      201,
    );
    const third = await book(player.token, { groundId: ground.id, ...at(hours, 2, 3) });
    expect(third.status).toBe(409);
    expect(await third.json()).toMatchObject({ code: "PAY_AT_VENUE_LIMIT", limit: 2 });

    // Someone else isn't held back by it.
    const other = await signedIn("+201005550001");
    expect((await book(other.token, { groundId: ground.id, ...at(hours, 2, 3) })).status).toBe(201);

    // Paid online, it doesn't count.
    const online = await aGround({ settings: { paymentMode: "PLATFORM" } });
    const paid = await book(player.token, {
      groundId: online.ground.id,
      ...at(online.hours, 3, 4),
    });
    expect(paid.status).toBe(201);
  });

  it("lets only one of two racing bookings take the last place", async () => {
    const { ground, hours } = await aGround();
    const player = await signedIn();
    expect((await book(player.token, { groundId: ground.id, ...at(hours, 0, 1) })).status).toBe(
      201,
    );
    const results = await Promise.all([
      book(player.token, { groundId: ground.id, ...at(hours, 1, 2) }),
      book(player.token, { groundId: ground.id, ...at(hours, 2, 3) }),
    ]);
    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
  });
});

describe("games", () => {
  it("lets a player host two at once, and no more", async () => {
    // Three bookings paid at the venue would stop first; this is about hosting.
    LIMITS.payAtVenue = 10;
    const { ground, hours } = await aGround();
    const booker = await signedIn();
    expect((await hosted(booker.token, ground.id, hours, 0)).status).toBe(200);
    expect((await hosted(booker.token, ground.id, hours, 1)).status).toBe(200);
    const third = await hosted(booker.token, ground.id, hours, 2);
    expect(third.status).toBe(409);
    expect(await codeOf(third.res)).toBe("HOSTING_LIMIT");
  });

  it("lets a player join two at once; leaving one makes room", async () => {
    const { ground, hours } = await aGround();
    const games: string[] = [];
    for (const [i, phone] of ["+201005550011", "+201005550012", "+201005550013"].entries()) {
      const booker = await signedIn(phone);
      const game = await hosted(booker.token, ground.id, hours, i);
      games.push(game.id ?? "");
    }
    const player = await signedIn();
    expect((await call(player.token, "POST", `/games/${games[0]}/join`)).ok).toBe(true);
    expect((await call(player.token, "POST", `/games/${games[1]}/join`)).ok).toBe(true);
    const third = await call(player.token, "POST", `/games/${games[2]}/join`);
    expect(third.status).toBe(409);
    expect(await codeOf(third)).toBe("JOINING_LIMIT");

    expect((await call(player.token, "POST", `/games/${games[0]}/leave`)).ok).toBe(true);
    expect((await call(player.token, "POST", `/games/${games[2]}/join`)).ok).toBe(true);
  });

  it("lets a player join the same game three times, leaving in between, and no more", async () => {
    const { ground, hours } = await aGround();
    const booker = await signedIn("+201005550011");
    const game = await hosted(booker.token, ground.id, hours, 0);
    const player = await signedIn();
    for (let i = 0; i < 3; i++) {
      expect((await call(player.token, "POST", `/games/${game.id}/join`)).ok).toBe(true);
      expect((await call(player.token, "POST", `/games/${game.id}/leave`)).ok).toBe(true);
    }
    const fourth = await call(player.token, "POST", `/games/${game.id}/join`);
    expect(fourth.status).toBe(409);
    expect(await fourth.json()).toMatchObject({ code: "REJOIN_LIMIT", limit: 3 });
  });

  it("stops joining for a day after leaving three games in a week", async () => {
    const { ground, hours } = await aGround();
    const games: string[] = [];
    const phones = ["+201005550011", "+201005550012", "+201005550013", "+201005550014"];
    for (const [i, phone] of phones.entries()) {
      const booker = await signedIn(phone);
      games.push((await hosted(booker.token, ground.id, hours, i)).id ?? "");
    }
    const player = await signedIn();
    // Two games left still lets them join; the third left starts the cool-off.
    for (const game of games.slice(0, 3)) {
      expect((await call(player.token, "POST", `/games/${game}/join`)).ok).toBe(true);
      expect((await call(player.token, "POST", `/games/${game}/leave`)).ok).toBe(true);
    }
    const cooling = await call(player.token, "POST", `/games/${games[3]}/join`);
    expect(cooling.status).toBe(409);
    const problem = (await cooling.json()) as { code: string; until: string; leaves: number };
    expect(problem).toMatchObject({ code: "JOINING_COOL_OFF", leaves: 3 });
    const until = Date.parse(problem.until);
    expect(until - Date.now()).toBeGreaterThan(23 * HOUR);
    expect(until - Date.now()).toBeLessThanOrEqual(24 * HOUR);

    // Once the day is up they can join again.
    await joinGame(player.customer.id, games[3] ?? "", { now: () => new Date(until + 1000) });
  });
});
