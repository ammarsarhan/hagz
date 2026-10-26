import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { resetDatabase } from "../support/database";
import { createMarketplace } from "../support/factories";

// Opens once both callers have reached it, so their transactions overlap for certain.
const meetingPoint = (parties: number) => {
  let arrived = 0;
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return async () => {
    if (++arrived === parties) open();
    await opened;
  };
};

beforeEach(resetDatabase);

describe("transaction", () => {
  it("retries a deadlock so both transactions commit", async () => {
    const [a, b] = await Promise.all([createMarketplace(), createMarketplace()]);
    const meet = meetingPoint(2);
    let attempts = 0;
    const lockBoth = (first: string, second: string) =>
      transaction(async (tx) => {
        attempts++;
        await tx.marketplace.update({ where: { id: first }, data: { taxRate: { increment: 1 } } });
        await meet();
        await tx.marketplace.update({ where: { id: second }, data: { taxRate: { increment: 1 } } });
      });

    await Promise.all([lockBoth(a.id, b.id), lockBoth(b.id, a.id)]);

    expect(attempts).toBeGreaterThan(2);
    const rows = await prisma.marketplace.findMany({ select: { taxRate: true } });
    expect(rows.map((r) => r.taxRate)).toEqual([2, 2]);
  });

  it("retries serialization failures without losing an update", async () => {
    const { id } = await createMarketplace();
    const increment = () =>
      transaction(
        async (tx) => {
          const { taxRate } = await tx.marketplace.findUniqueOrThrow({ where: { id } });
          await new Promise((resolve) => setTimeout(resolve, 10));
          await tx.marketplace.update({ where: { id }, data: { taxRate: taxRate + 1 } });
        },
        { isolationLevel: "Serializable", maxAttempts: 10 },
      );

    await Promise.all(Array.from({ length: 5 }, increment));

    const { taxRate } = await prisma.marketplace.findUniqueOrThrow({ where: { id } });
    expect(taxRate).toBe(5);
  });

  it("does not retry other errors", async () => {
    const { code } = await createMarketplace();
    let attempts = 0;
    const duplicate = transaction(async (tx) => {
      attempts++;
      await tx.marketplace.create({
        data: { code, currency: "EGP", dialCode: "+20", timezone: "Africa/Cairo" },
      });
    });

    await expect(duplicate).rejects.toThrow();
    expect(attempts).toBe(1);
  });

  it("rolls back everything when the work throws", async () => {
    const failing = transaction(async (tx) => {
      await tx.marketplace.create({
        data: { code: "ZZ", currency: "EGP", dialCode: "+20", timezone: "Africa/Cairo" },
      });
      throw new Error("boom");
    });

    await expect(failing).rejects.toThrow("boom");
    expect(await prisma.marketplace.count()).toBe(0);
  });
});
