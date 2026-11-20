import { randomUUID } from "node:crypto";
import { FavoriteVenues } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { signJwt } from "@/platform/crypto/jwt";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import { createCustomer, createMarketplace, createVenue } from "../../support/factories";
import { resetRedis } from "../../support/redis";

// Favorites (PR 3.4): saving, listing and removing a player's venues.

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
});

const signedIn = async () => {
  const customer = await createCustomer();
  const token = await signJwt(
    { sub: customer.id, sid: randomUUID() },
    { audience: "customer", ttlSeconds: 600 },
  );
  return { customer, token };
};

const call = (method: string, path: string, token: string | null) =>
  router.request(`/v1/customers/me/favorites${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

const list = async (token: string) => {
  const res = await call("GET", "", token);
  expect(res.status).toBe(200);
  return FavoriteVenues.parse(await res.json()).data;
};

describe("favorites", () => {
  it("saves, lists and removes venues, both idempotently", async () => {
    const marketplace = await createMarketplace({ code: "EG" });
    const first = await createVenue(marketplace.id);
    const second = await createVenue(marketplace.id);
    const { token } = await signedIn();

    expect((await call("PUT", `/${first.id}`, token)).status).toBe(204);
    expect((await call("PUT", `/${second.id}`, token)).status).toBe(204);
    expect((await call("PUT", `/${first.id}`, token)).status).toBe(204);
    // Most recently saved first; saving again kept the first time.
    expect((await list(token)).map((venue) => venue.id)).toEqual([second.id, first.id]);

    expect((await call("DELETE", `/${second.id}`, token)).status).toBe(204);
    expect((await call("DELETE", `/${second.id}`, token)).status).toBe(204);
    expect((await list(token)).map((venue) => venue.id)).toEqual([first.id]);
  });

  it("saves only listed venues, and marks saved ones taken off the list", async () => {
    const marketplace = await createMarketplace({ code: "EG" });
    const venue = await createVenue(marketplace.id);
    const draft = await createVenue(marketplace.id);
    await prisma.venue.update({ where: { id: draft.id }, data: { status: "DRAFT" } });
    const { token } = await signedIn();

    const refused = await call("PUT", `/${draft.id}`, token);
    expect(refused.status).toBe(404);
    expect(await refused.json()).toMatchObject({ code: "VENUE_NOT_FOUND" });
    expect((await call("PUT", `/${randomUUID()}`, token)).status).toBe(404);

    await call("PUT", `/${venue.id}`, token);
    await prisma.venue.update({ where: { id: venue.id }, data: { status: "MAINTENANCE" } });
    expect((await list(token))[0]?.status).toBe("MAINTENANCE");
    await prisma.venue.update({ where: { id: venue.id }, data: { status: "DRAFT" } });
    expect((await list(token))[0]?.status).toBe("UNAVAILABLE");
  });

  it("keeps each player's favorites their own, and needs signing in", async () => {
    const marketplace = await createMarketplace({ code: "EG" });
    const venue = await createVenue(marketplace.id);
    const { token } = await signedIn();
    const other = await createCustomer({ phone: "+201009876543" });
    const otherToken = await signJwt(
      { sub: other.id, sid: randomUUID() },
      { audience: "customer", ttlSeconds: 600 },
    );
    await call("PUT", `/${venue.id}`, token);
    expect(await list(otherToken)).toEqual([]);
    expect((await call("GET", "", null)).status).toBe(401);
    expect((await call("PUT", `/${venue.id}`, null)).status).toBe(401);
  });
});
