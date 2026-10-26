import { describe, expect, it } from "vitest";
import {
  isDatabaseUnavailable,
  isRetryableConflict,
  violatedUniqueIndex,
} from "@/platform/db/errors";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";

describe("database settings", () => {
  it("applies the timeouts from the migration", async () => {
    const [settings] = await prisma.$queryRaw<{ statement: string; lock: string; idle: string }[]>`
      SELECT current_setting('statement_timeout') AS statement,
             current_setting('lock_timeout') AS lock,
             current_setting('idle_in_transaction_session_timeout') AS idle`;
    expect(settings).toEqual({ statement: "5s", lock: "2s", idle: "30s" });
  });
});

describe("database error classification", () => {
  it("treats a statement timeout as unavailable, not as a conflict", async () => {
    const slow = transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = 50`;
      await tx.$queryRaw`SELECT pg_sleep(1)::text`;
    });

    const error: unknown = await slow.catch((e: unknown) => e);
    expect(isDatabaseUnavailable(error)).toBe(true);
    expect(isRetryableConflict(error)).toBe(false);
  });

  it("treats a lock timeout as unavailable", async () => {
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS lock_probe (id int PRIMARY KEY)`;
    await prisma.$executeRaw`INSERT INTO lock_probe VALUES (1) ON CONFLICT DO NOTHING`;
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const isLocked = new Promise<void>((resolve) => (locked = resolve));

    const holder = transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM lock_probe WHERE id = 1 FOR UPDATE`;
      locked();
      await held;
    });
    await isLocked;
    const waiter = transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL lock_timeout = 50`;
      await tx.$queryRaw`SELECT id FROM lock_probe WHERE id = 1 FOR UPDATE`;
    });

    const error: unknown = await waiter.catch((e: unknown) => e);
    release();
    await holder;
    await prisma.$executeRaw`DROP TABLE lock_probe`;
    expect(isDatabaseUnavailable(error)).toBe(true);
  });

  it("names the unique index a duplicate violated", async () => {
    const data = { code: "ZU", currency: "EGP", dialCode: "+20", timezone: "Africa/Cairo" };
    await prisma.marketplace.create({ data });

    const error: unknown = await prisma.marketplace.create({ data }).catch((e: unknown) => e);

    expect(violatedUniqueIndex(error)).toBe("Marketplace_code_key");
    await prisma.marketplace.deleteMany({ where: { code: "ZU" } });
  });

  // Shapes logged while killing Postgres under load (pg adapter, Prisma 7). A real outage can't be
  // produced inside the shared test database, so these copies keep the classification honest.
  it.each([
    [
      "a connection closed mid-query (P1017)",
      Object.assign(new Error("Server has closed the connection."), {
        name: "PrismaClientKnownRequestError",
        code: "P1017",
        meta: {
          driverAdapterError: { name: "DriverAdapterError", cause: { kind: "ConnectionClosed" } },
        },
      }),
    ],
    ["a bare pg termination", new Error("Connection terminated unexpectedly")],
    [
      "an unreachable server",
      Object.assign(new Error(""), { name: "PrismaClientKnownRequestError", code: "ECONNREFUSED" }),
    ],
  ])("treats %s as unavailable", (_, error) => {
    expect(isDatabaseUnavailable(error)).toBe(true);
  });

  it("keeps misconfiguration a 500: retrying won't fix bad credentials", () => {
    const error = Object.assign(new Error("Authentication failed"), {
      name: "PrismaClientKnownRequestError",
      code: "P1000",
      meta: {
        driverAdapterError: { name: "DriverAdapterError", cause: { kind: "AuthenticationFailed" } },
      },
    });
    expect(isDatabaseUnavailable(error)).toBe(false);
  });

  it("ignores errors that didn't come from the database", () => {
    const error = new Error("boom");
    expect(isRetryableConflict(error)).toBe(false);
    expect(isDatabaseUnavailable(error)).toBe(false);
    expect(violatedUniqueIndex(error)).toBeUndefined();
  });
});
