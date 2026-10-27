import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { createIdempotently, replayHeaders } from "@/platform/idempotency/idempotency";
import { resetDatabase } from "../support/database";

// Marketplace.code stands in for an idempotency key column: same unique-index mechanics, no fixtures.
const KEY = "ZK";
const create = (timezone: string) =>
  createIdempotently({
    index: "Marketplace_code_key",
    find: () => prisma.marketplace.findUnique({ where: { code: KEY } }),
    matches: (existing) => existing.timezone === timezone,
    create: () =>
      transaction((tx) =>
        tx.marketplace.create({ data: { code: KEY, currency: "EGP", dialCode: "+20", timezone } }),
      ),
  });

beforeEach(resetDatabase);

describe("createIdempotently", () => {
  it("creates once and replays a retry", async () => {
    const first = await create("Africa/Cairo");
    const retry = await create("Africa/Cairo");

    expect(first.replayed).toBe(false);
    expect(retry).toEqual({ value: first.value, replayed: true });
    expect(replayHeaders(first)).toEqual({});
    expect(replayHeaders(retry)).toEqual({ "Idempotent-Replayed": "true" });
  });

  it("leaves one row when 20 identical requests race", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => create("Africa/Cairo")));

    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(new Set(results.map((r) => r.value.id)).size).toBe(1);
    expect(await prisma.marketplace.count()).toBe(1);
  });

  it("rejects the same key for a different request", async () => {
    await create("Africa/Cairo");

    const reuse = create("Asia/Dubai");

    await expect(reuse).rejects.toBeInstanceOf(AppError);
    await expect(reuse).rejects.toMatchObject({ status: 422, code: "IDEMPOTENCY_KEY_REUSED" });
  });

  it("rethrows a unique violation on any other index", async () => {
    const other = createIdempotently({
      index: "Booking_venueId_idempotencyKey_key",
      find: () => Promise.resolve(null),
      matches: () => true,
      create: async () => {
        await prisma.marketplace.create({
          data: { code: KEY, currency: "EGP", dialCode: "+20", timezone: "Africa/Cairo" },
        });
        return prisma.marketplace.create({
          data: { code: KEY, currency: "EGP", dialCode: "+20", timezone: "Africa/Cairo" },
        });
      },
    });

    await expect(other).rejects.toMatchObject({ code: "P2002" });
  });
});
