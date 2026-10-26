import { violatedUniqueIndex } from "@/platform/db/errors";
import { AppError } from "@/platform/errors/app-error";

export interface IdempotentCreate<T> {
  // The unique index that holds the key, e.g. "Booking_venueId_idempotencyKey_key".
  index: string;
  // Loads the row already stored under this key, if any.
  find: () => Promise<T | null>;
  // Whether that row belongs to this caller and was made by the same request (same ground, times,
  // amount...). Anything else gets a 422, so a key can't be used to read someone else's row.
  matches: (existing: T) => boolean;
  // Creates the row, with the key, normally in a transaction.
  create: () => Promise<T>;
}

export interface IdempotentResult<T> {
  value: T;
  // True when this is a retry answered with the stored row (Idempotent-Replayed: true).
  replayed: boolean;
}

const keyReused = () =>
  new AppError({
    code: "IDEMPOTENCY_KEY_REUSED",
    status: 422,
    detail: "This Idempotency-Key was already used for a different request.",
  });

// Makes a create safe to retry using the idempotency key column on the row itself
// (docs/architecture.md, "Idempotency"). The unique index is the real guard; the lookup first is
// only a fast path for the common retry.
export const createIdempotently = async <T>({
  index,
  find,
  matches,
  create,
}: IdempotentCreate<T>): Promise<IdempotentResult<T>> => {
  const replay = (existing: T): IdempotentResult<T> => {
    if (!matches(existing)) throw keyReused();
    return { value: existing, replayed: true };
  };

  const existing = await find();
  if (existing) return replay(existing);

  try {
    return { value: await create(), replayed: false };
  } catch (error) {
    // A concurrent request with the same key committed first: Postgres made this insert wait for it,
    // then rejected it. Answer with the winner.
    if (violatedUniqueIndex(error) !== index) throw error;
    const winner = await find();
    if (!winner) throw error;
    return replay(winner);
  }
};

// Response headers for an idempotent create. The status stays the original one (e.g. 201).
export const replayHeaders = (result: IdempotentResult<unknown>): Record<string, string> =>
  result.replayed ? { "Idempotent-Replayed": "true" } : {};
