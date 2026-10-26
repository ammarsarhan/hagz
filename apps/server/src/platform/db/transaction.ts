import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";
import { isRetryableConflict, sqlState } from "@/platform/db/errors";
import { logger } from "@/platform/logger/logger";

export type Tx = Prisma.TransactionClient;

export interface TransactionOptions {
  // ReadCommitted (Postgres' default) plus row locks covers most writes. Use Serializable when a
  // decision rests on rows the transaction only reads, e.g. checking a balance before a payout.
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxAttempts?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs `work` in one transaction, and runs it again from the start when Postgres aborts it for a
// serialization failure or deadlock. So `work` must only touch the database: no HTTP calls, no
// enqueued jobs, nothing that a second run would repeat. Side effects happen after commit.
export const transaction = async <T>(
  work: (tx: Tx) => Promise<T>,
  { isolationLevel = "ReadCommitted", maxAttempts = 3 }: TransactionOptions = {},
): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel,
        // Waiting for a pooled connection, then the whole transaction. Both end before the 15 s
        // request timeout; the database's own statement_timeout (5 s) cancels any slow statement.
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableConflict(error)) throw error;
      // Jittered backoff so the transactions that collided don't collide again.
      const delayMs = Math.round(25 * 2 ** attempt * (0.5 + Math.random()));
      logger.warn(
        { attempt, sqlState: sqlState(error), delayMs },
        "transaction conflict, retrying",
      );
      await sleep(delayMs);
    }
  }
};
