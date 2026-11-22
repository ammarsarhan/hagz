import { randomUUID } from "node:crypto";
import { router } from "@/http/router";
import { signJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import { createCustomer, createMarketplace, createVenue } from "./factories";

// Fixtures for booking tests: a live venue with a ground and free hours, signed-in players, and the
// booking routes.

export const HOUR = 3_600_000;

// Four free hours on one ground, starting at the next whole hour a day from now: [0] to [3].
export const aGround = async ({
  settings = {},
  venue: venueData = {},
  marketplace: marketplaceData = {},
}: {
  settings?: Record<string, unknown>;
  venue?: Record<string, unknown>;
  marketplace?: Record<string, unknown>;
} = {}) => {
  const marketplace = await createMarketplace();
  if (Object.keys(marketplaceData).length > 0) {
    await prisma.marketplace.update({ where: { id: marketplace.id }, data: marketplaceData });
  }
  const venue = await createVenue(marketplace.id);
  await prisma.venue.update({
    where: { id: venue.id },
    data: { translations: { create: { language: "EN", name: "Maadi Arena" } }, ...venueData },
  });
  await prisma.venueSettings.create({
    data: {
      venueId: venue.id,
      defaultPermissions: {},
      cancellationPolicy: "MODERATE",
      ...settings,
    },
  });
  const ground = await prisma.ground.create({
    data: {
      venueId: venue.id,
      sport: "FOOTBALL",
      size: "FIVE_A_SIDE",
      surface: "ARTIFICIAL_TURF",
      environment: "OUTDOOR",
      position: 0,
      basePrice: 40_000,
      peakPrice: 60_000,
      translations: { create: { language: "EN", name: "Pitch 1" } },
      settings: { create: { scheduleVersion: 1, minimumSlots: 1, maximumSlots: 3 } },
    },
  });
  const first = Math.ceil(Date.now() / HOUR) * HOUR + 24 * HOUR;
  const hours = [0, 1, 2, 3].map((i) => new Date(first + i * HOUR));
  await prisma.groundSlot.createMany({
    data: hours.map((startsAt, i) => ({
      groundId: ground.id,
      venueId: venue.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + HOUR),
      tier: i < 2 ? ("BASE" as const) : ("PEAK" as const),
      price: i < 2 ? 40_000 : 60_000,
      scheduleVersion: 1,
    })),
  });
  return { marketplace, venue, ground, hours };
};

export const at = (hours: Date[], from: number, to: number) => ({
  startsAt: hours[from]?.toISOString(),
  endsAt: new Date((hours[to - 1]?.getTime() ?? 0) + HOUR).toISOString(),
});

export const signedIn = async (phone = "+201001234567") => {
  const customer = await createCustomer({ phone });
  const token = await signJwt(
    { sub: customer.id, sid: randomUUID() },
    { audience: "customer", ttlSeconds: 600 },
  );
  return { customer, token };
};

export const book = async (token: string, body: object, key: string = randomUUID()) =>
  router.request("/v1/bookings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept-Language": "en",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(body),
  });

export const quote = (body: object) =>
  router.request("/v1/bookings/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept-Language": "en" },
    body: JSON.stringify(body),
  });
