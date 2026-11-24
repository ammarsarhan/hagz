import { createBooking } from "@/modules/bookings";
import { settlePayment, startCheckout } from "@/modules/payments";
import { env } from "@/platform/config/env";
import { hashPassword } from "@/platform/crypto/passwords";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";

// Development only: bookings at random times across one venue's grounds, so its calendar, the admin
// Bookings table and the player's Bookings tab have something in them. Every booking goes through
// the real path (createBooking, then a fake checkout where the venue takes money online), so
// charges, events, slots and statuses are exactly what a player's booking makes. Players come from
// a fixed pool of seed accounts, made on first use. Each call adds more bookings in whatever time
// is still free. Not a command of its own: seed:alexandria calls it, `seedBookings(venueId, {...})`.

export interface SeedBookingsOptions {
  // How many bookings to try to make; fewer are made when the free time runs out.
  count?: number;
  // How far ahead bookings start: from an hour from now to this many days out.
  days?: number;
  // Of the bookings left awaiting payment (deposit or online venues), the share paid for; the rest
  // stay held and the expiry sweep frees them.
  payRate?: number;
  // The same seed over the same free slots picks the same bookings.
  seed?: number;
}

export interface SeededBookings {
  made: number;
  byStatus: Record<string, number>;
  skipped: number;
}

// +20 100 000 0010 to 0017: not numbers anyone owns (the seed owner is +20 100 000 0000).
const PLAYERS = [
  "Omar Hassan",
  "Youssef Adel",
  "Mariam Fathy",
  "Karim Nabil",
  "Hana Mostafa",
  "Ziad Samir",
  "Salma Ibrahim",
  "Mahmoud Tarek",
].map((name, i) => ({ name, phone: `+2010000000${String(10 + i)}` }));
const PLAYER_PASSWORD = "seed-player-password";
const NOTES = [
  "Bibs please",
  "We'll bring our own ball",
  "Birthday game",
  "Might be 10 minutes late",
];
const HOUR = 3_600_000;

// mulberry32: small, fast and repeatable, which Math.random isn't.
const randomFrom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const ensurePlayers = async () => {
  const passwordHash = await hashPassword(PLAYER_PASSWORD);
  return Promise.all(
    PLAYERS.map((player) =>
      prisma.customer.upsert({
        where: { phone: player.phone },
        update: {},
        create: {
          ...player,
          passwordHash,
          phoneVerifiedAt: new Date(),
          language: "EN",
          timezone: "Africa/Cairo",
        },
        select: { id: true, status: true },
      }),
    ),
  ).then((players) => players.filter((player) => player.status === "ACTIVE"));
};

export const seedBookings = async (
  venueId: string,
  { count = 20, days = 14, payRate = 0.8, seed = Date.now() }: SeedBookingsOptions = {},
): Promise<SeededBookings> => {
  if (env.APP_ENV !== "development") {
    throw new Error(`Refusing to seed bookings in ${env.APP_ENV}: local development only.`);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(venueId)) {
    throw new Error(`"${venueId}" isn't a venue id (a uuid).`);
  }
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: {
      status: true,
      grounds: {
        where: { status: "ACTIVE" },
        select: { id: true, settings: { select: { minimumSlots: true, maximumSlots: true } } },
      },
    },
  });
  if (!venue) throw new Error(`No venue ${venueId}.`);
  if (venue.status !== "LIVE") throw new Error(`Venue ${venueId} is ${venue.status}, not LIVE.`);

  const random = randomFrom(seed);
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)] as T;
  const players = await ensurePlayers();

  // Every free slot in the window, per ground in time order. Used slots are taken out as bookings
  // are made, so later picks don't aim at them.
  const from = new Date(Date.now() + HOUR);
  const to = new Date(Date.now() + days * 24 * HOUR);
  const free = new Map<string, { startsAt: Date; endsAt: Date }[]>();
  for (const ground of venue.grounds) {
    free.set(
      ground.id,
      await prisma.groundSlot.findMany({
        where: { groundId: ground.id, status: "AVAILABLE", startsAt: { gte: from, lt: to } },
        orderBy: { startsAt: "asc" },
        select: { startsAt: true, endsAt: true },
      }),
    );
  }

  const result: SeededBookings = { made: 0, byStatus: {}, skipped: 0 };
  // Give up after many misses in a row: the window is too full to fit more.
  let misses = 0;
  while (result.made < count && misses < 50) {
    const ground = pick(venue.grounds);
    const slots = free.get(ground.id) ?? [];
    const minimum = ground.settings?.minimumSlots ?? 1;
    const maximum = ground.settings?.maximumSlots ?? minimum;
    if (slots.length < minimum) {
      misses++;
      continue;
    }
    // A random start, then as many back-to-back free slots after it as the length wants.
    const start = Math.floor(random() * slots.length);
    const wanted = minimum + Math.floor(random() * (maximum - minimum + 1));
    let length = 1;
    while (
      length < wanted &&
      slots[start + length]?.startsAt.getTime() === slots[start + length - 1]?.endsAt.getTime()
    ) {
      length++;
    }
    const first = slots[start];
    const last = slots[start + length - 1];
    if (!first || !last || length < minimum) {
      misses++;
      continue;
    }
    slots.splice(start, length);

    const player = pick(players);
    try {
      const { value: bookingId } = await createBooking(
        player.id,
        {
          groundId: ground.id,
          startsAt: first.startsAt.toISOString(),
          endsAt: last.endsAt.toISOString(),
          amenities: [],
          note: random() < 0.25 ? pick(NOTES) : undefined,
        },
        crypto.randomUUID(),
      );
      let { status } = await prisma.booking.findUniqueOrThrow({
        where: { id: bookingId },
        select: { status: true },
      });
      if (status === "HELD" && random() < payRate) {
        // Now and then a declined card first, as players have.
        if (random() < 0.2) await pay(player.id, bookingId, "FAILED");
        await pay(player.id, bookingId, "SUCCEEDED");
        status = "CONFIRMED";
      }
      result.made++;
      result.byStatus[status] = (result.byStatus[status] ?? 0) + 1;
      misses = 0;
    } catch (error) {
      // Free when read but not bookable now (inside the notice, taken meanwhile): try elsewhere.
      if (!(error instanceof AppError)) throw error;
      result.skipped++;
      misses++;
    }
  }
  return result;
};

const pay = async (customerId: string, bookingId: string, outcome: "SUCCEEDED" | "FAILED") => {
  const { checkout } = await startCheckout(
    customerId,
    bookingId,
    { method: "CARD" },
    crypto.randomUUID(),
  );
  await settlePayment(checkout.payment.id, outcome);
};
