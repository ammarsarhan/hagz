import { randomUUID } from "node:crypto";
import { Booking, BookingQuote } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/platform/db/prisma";
import { aGround, at, book, HOUR, quote, signedIn } from "../../support/bookings";
import { resetDatabase } from "../../support/database";
import { resetRedis } from "../../support/redis";

// Booking a ground in the app (PR 4.1): claiming slots so exactly one player gets them, the charges
// and terms copied onto the booking, where it starts, and retries with an Idempotency-Key.

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

describe("booking a ground", () => {
  it("books back-to-back slots, confirmed at once, with its charges and terms", async () => {
    const { ground, hours, venue } = await aGround();
    const { customer, token } = await signedIn();

    const res = await book(token, {
      groundId: ground.id,
      ...at(hours, 1, 3),
      note: " Bibs please ",
    });
    expect(res.status).toBe(201);
    expect(res.headers.get("Idempotent-Replayed")).toBeNull();
    const booking = Booking.parse(await res.json());
    expect(booking).toMatchObject({
      status: "CONFIRMED",
      expiresAt: null,
      venue: { id: venue.id, name: "Maadi Arena" },
      ground: { id: ground.id, name: "Pitch 1", sport: "FOOTBALL" },
      currency: "EGP",
      total: 100_000,
      tax: 0,
      paymentMode: "MANUAL",
      deposit: null,
      cancellation: { policy: "MODERATE" },
      note: "Bibs please",
    });
    expect(booking.code).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    expect(booking.charges.map((charge) => [charge.type, charge.tier, charge.amount])).toEqual([
      ["SLOT", "BASE", 40_000],
      ["SLOT", "PEAK", 60_000],
    ]);

    const slots = await prisma.groundSlot.findMany({
      where: { groundId: ground.id },
      orderBy: { startsAt: "asc" },
    });
    expect(slots.map((slot) => [slot.status, slot.bookingId])).toEqual([
      ["AVAILABLE", null],
      ["BOOKED", booking.id],
      ["BOOKED", booking.id],
      ["AVAILABLE", null],
    ]);
    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { customer: true, events: true },
    });
    expect(stored.customer).toMatchObject({ customerId: customer.id, phone: customer.phone });
    expect(stored.creatorId).toBeNull();
    expect(stored.events).toEqual([
      expect.objectContaining({
        type: "CREATED",
        customerId: customer.id,
        data: { status: "CONFIRMED" },
      }),
    ]);
  });

  it("quotes the same price it then books, open to guests", async () => {
    const { ground, hours } = await aGround();
    const { token } = await signedIn();
    const request = { groundId: ground.id, ...at(hours, 1, 3) };

    const res = await quote(request);
    expect(res.status).toBe(200);
    const priced = BookingQuote.parse(await res.json());
    expect(priced).toMatchObject({ total: 100_000, startsAs: "CONFIRMED", deposit: null });

    const booking = Booking.parse(await (await book(token, request)).json());
    expect(booking.total).toBe(priced.total);
    expect(booking.charges).toEqual(priced.charges);
  });

  it("charges VAT for a venue with a tax number, and priced extras per hour or per booking", async () => {
    const { ground, hours, venue, marketplace } = await aGround({
      venue: { taxNumber: "123-456-789" },
      marketplace: { taxRate: 1400 },
    });
    const option = (key: string) =>
      prisma.amenityOption.create({
        data: {
          marketplaceId: marketplace.id,
          key,
          icon: "parking",
          translations: { create: { language: "EN", name: key } },
        },
      });
    const lights = await option("floodlights");
    const ball = await option("ball");
    const parking = await option("parking");
    await prisma.venueAmenity.createMany({
      data: [
        {
          venueId: venue.id,
          marketplaceId: marketplace.id,
          optionId: lights.id,
          price: 5_000,
          pricing: "PER_HOUR",
        },
        {
          venueId: venue.id,
          marketplaceId: marketplace.id,
          optionId: ball.id,
          price: 2_000,
          pricing: "PER_BOOKING",
        },
        { venueId: venue.id, marketplaceId: marketplace.id, optionId: parking.id },
      ],
    });
    const { token } = await signedIn();

    const res = await book(token, {
      groundId: ground.id,
      ...at(hours, 0, 2),
      amenities: [lights.id, ball.id, lights.id],
    });
    expect(res.status).toBe(201);
    const booking = Booking.parse(await res.json());
    expect(booking.total).toBe(80_000 + 10_000 + 2_000);
    expect(booking.tax).toBe(booking.charges.reduce((sum, charge) => sum + charge.taxAmount, 0));
    expect(booking.tax).toBeGreaterThan(0);
    expect(
      booking.charges.filter((charge) => charge.type === "AMENITY").map((charge) => charge.amenity),
    ).toEqual(
      expect.arrayContaining([
        { id: lights.id, name: "floodlights", pricing: "PER_HOUR" },
        { id: ball.id, name: "ball", pricing: "PER_BOOKING" },
      ]),
    );

    // A free amenity isn't an extra to add.
    const free = await book(token, {
      groundId: ground.id,
      ...at(hours, 2, 3),
      amenities: [parking.id],
    });
    expect(free.status).toBe(422);
    expect(await free.json()).toMatchObject({ code: "AMENITY_NOT_AVAILABLE" });
  });

  it("waits for approval when the venue approves each booking", async () => {
    const { ground, hours } = await aGround({ settings: { autoConfirm: false } });
    const { token } = await signedIn();

    const booking = Booking.parse(
      await (await book(token, { groundId: ground.id, ...at(hours, 0, 1) })).json(),
    );
    expect(booking.status).toBe("PENDING");
    // A day ahead: the 12 hours run out first.
    const expiresIn = new Date(booking.expiresAt ?? 0).getTime() - Date.now();
    expect(expiresIn).toBeGreaterThan(11.9 * HOUR);
    expect(expiresIn).toBeLessThanOrEqual(12 * HOUR);
    const slot = await prisma.groundSlot.findFirstOrThrow({ where: { bookingId: booking.id } });
    expect(slot.status).toBe("HELD");
  });

  it("waits for a deposit, held for the payment window", async () => {
    const { ground, hours } = await aGround({
      settings: { paymentMode: "DEPOSIT", depositPercent: 25, paymentWindow: 20 },
    });
    const { token } = await signedIn();

    const booking = Booking.parse(
      await (await book(token, { groundId: ground.id, ...at(hours, 0, 2) })).json(),
    );
    expect(booking).toMatchObject({
      status: "HELD",
      paymentMode: "DEPOSIT",
      total: 80_000,
      deposit: 20_000,
    });
    const expiresIn = new Date(booking.expiresAt ?? 0).getTime() - Date.now();
    expect(expiresIn).toBeGreaterThan(19 * 60_000);
    expect(expiresIn).toBeLessThanOrEqual(20 * 60_000);
  });

  it("refuses taken time, gaps, the wrong length and too little notice", async () => {
    const { ground, hours } = await aGround({ settings: { minimumNotice: 1440 } });
    await prisma.groundSettings.update({
      where: { groundId: ground.id },
      data: { minimumSlots: 2 },
    });
    const { token } = await signedIn();
    const { token: other } = await signedIn("+201009876543");

    expect((await book(token, { groundId: ground.id, ...at(hours, 1, 3) })).status).toBe(201);

    const taken = await book(other, { groundId: ground.id, ...at(hours, 2, 4) });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toMatchObject({ code: "SLOT_UNAVAILABLE" });

    await prisma.groundSlot.deleteMany({ where: { groundId: ground.id, startsAt: hours[3] } });
    const pastTheEnd = await book(other, {
      groundId: ground.id,
      startsAt: hours[3]?.toISOString(),
      endsAt: new Date((hours[3]?.getTime() ?? 0) + 2 * HOUR).toISOString(),
    });
    expect(pastTheEnd.status).toBe(409);

    const short = await book(other, { groundId: ground.id, ...at(hours, 0, 1) });
    expect(short.status).toBe(422);
    expect(await short.json()).toMatchObject({
      code: "INVALID_BOOKING_TIME",
      minimumSlots: 2,
      maximumSlots: 3,
    });

    // A day's notice, and the first hour starts a little under a day from now.
    await prisma.venueSettings.updateMany({ data: { minimumNotice: 1500 } });
    const soon = await book(other, { groundId: ground.id, ...at(hours, 0, 1) });
    expect(soon.status).toBe(422);
    expect(await soon.json()).toMatchObject({ code: "INVALID_BOOKING_TIME", minimumNotice: 1500 });

    // Nothing was written by the refusals.
    expect(await prisma.booking.count()).toBe(1);
  });

  it("refuses paused venues, venues not live, and grounds under maintenance", async () => {
    const { ground, hours, venue } = await aGround();
    const { token } = await signedIn();
    const request = { groundId: ground.id, ...at(hours, 0, 1) };

    await prisma.venue.update({ where: { id: venue.id }, data: { status: "MAINTENANCE" } });
    expect(await (await book(token, request)).json()).toMatchObject({ code: "VENUE_PAUSED" });
    await prisma.venue.update({ where: { id: venue.id }, data: { status: "DRAFT" } });
    expect((await book(token, request)).status).toBe(404);
    await prisma.venue.update({ where: { id: venue.id }, data: { status: "LIVE" } });
    await prisma.ground.update({ where: { id: ground.id }, data: { status: "MAINTENANCE" } });
    expect(await (await book(token, request)).json()).toMatchObject({ code: "GROUND_UNAVAILABLE" });
    expect((await book(token, { ...request, groundId: randomUUID() })).status).toBe(404);
  });

  it("makes a walk-in kept under the player's number their record", async () => {
    const { ground, hours, venue } = await aGround();
    const walkIn = await prisma.venueCustomer.create({
      data: { venueId: venue.id, name: "Ahmed (phone)", phone: "+201001234567" },
    });
    const { customer, token } = await signedIn();

    const booking = Booking.parse(
      await (await book(token, { groundId: ground.id, ...at(hours, 0, 1) })).json(),
    );
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(stored.customerId).toBe(walkIn.id);
    expect(
      await prisma.venueCustomer.findUniqueOrThrow({ where: { id: walkIn.id } }),
    ).toMatchObject({
      customerId: customer.id,
    });
    // The next booking there uses the same record.
    const next = Booking.parse(
      await (await book(token, { groundId: ground.id, ...at(hours, 1, 2) })).json(),
    );
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: next.id } })).customerId).toBe(
      walkIn.id,
    );
    expect(await prisma.venueCustomer.count()).toBe(1);
  });

  it("answers a retry with the same booking, and refuses the key for another one", async () => {
    const { ground, hours } = await aGround();
    const { token } = await signedIn();
    const key = randomUUID();
    const request = { groundId: ground.id, ...at(hours, 0, 1) };

    const first = Booking.parse(await (await book(token, request, key)).json());
    const retry = await book(token, request, key);
    expect(retry.status).toBe(201);
    expect(retry.headers.get("Idempotent-Replayed")).toBe("true");
    expect(Booking.parse(await retry.json()).id).toBe(first.id);

    const reused = await book(token, { groundId: ground.id, ...at(hours, 1, 2) }, key);
    expect(reused.status).toBe(422);
    expect(await reused.json()).toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });

    // Another player can't read the booking with its key.
    const { token: other } = await signedIn("+201009876543");
    expect((await book(other, request, key)).status).toBe(422);
    expect(await prisma.booking.count()).toBe(1);
  });
});

describe("racing for a slot", () => {
  it("gives 100 parallel requests for one slot exactly one booking, and the rest a quick 409", async () => {
    const { ground, hours } = await aGround();
    const players = await Promise.all(
      Array.from({ length: 100 }, (_, i) => signedIn(`+2010${String(10_000_000 + i)}`)),
    );
    const request = { groundId: ground.id, ...at(hours, 0, 2) };

    const started = Date.now();
    const responses = await Promise.all(players.map(({ token }) => book(token, request)));
    const elapsed = Date.now() - started;

    const statuses = responses.map((res) => res.status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(99);
    const bodies = await Promise.all(
      responses.filter((res) => res.status === 409).map((res) => res.json()),
    );
    expect(bodies.every((body) => (body as { code: string }).code === "SLOT_UNAVAILABLE")).toBe(
      true,
    );
    expect(await prisma.booking.count()).toBe(1);
    // Losers wait on locks for at most the winner's transaction, never a lock timeout.
    expect(elapsed).toBeLessThan(10_000);
  });

  it("gives overlapping requests one booking between them", async () => {
    const { ground, hours } = await aGround();
    const players = await Promise.all(
      Array.from({ length: 20 }, (_, i) => signedIn(`+2011${String(10_000_000 + i)}`)),
    );
    // Half want hours 0–1, half want 1–2: they share hour 1.
    const responses = await Promise.all(
      players.map(({ token }, i) =>
        book(token, { groundId: ground.id, ...(i % 2 ? at(hours, 0, 2) : at(hours, 1, 3)) }),
      ),
    );
    expect(responses.filter((res) => res.status === 201)).toHaveLength(1);
    expect(await prisma.booking.count()).toBe(1);
  });

  it("answers parallel retries of one request with the same booking", async () => {
    const { ground, hours } = await aGround();
    const { token } = await signedIn();
    const key = randomUUID();

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        book(token, { groundId: ground.id, ...at(hours, 0, 1) }, key),
      ),
    );
    expect(responses.map((res) => res.status)).toEqual(Array(10).fill(201));
    const ids = await Promise.all(responses.map(async (res) => Booking.parse(await res.json()).id));
    expect(new Set(ids).size).toBe(1);
    expect(
      responses.filter((res) => res.headers.get("Idempotent-Replayed") === "true"),
    ).toHaveLength(9);
    expect(await prisma.booking.count()).toBe(1);
  });
});
