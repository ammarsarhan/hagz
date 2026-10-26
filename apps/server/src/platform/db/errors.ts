// Prisma 7 with the pg driver adapter reports the same Postgres error in different shapes depending
// on where it surfaces (verified against Postgres 18):
// - model API: PrismaClientKnownRequestError P2034 (conflict) or P2002 (unique), with
//   meta.driverAdapterError.cause holding the SQLSTATE;
// - raw queries: P2010 with the same meta;
// - sometimes a bare DriverAdapterError, with the SQLSTATE on its own cause.
// These helpers read all of them, so callers never inspect Prisma errors themselves.

interface AdapterCause {
  originalCode?: string;
  kind?: string;
  constraint?: { index?: string };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const adapterCause = (error: unknown): AdapterCause | undefined => {
  if (!isObject(error)) return undefined;
  if (error.name === "DriverAdapterError" && isObject(error.cause)) return error.cause;
  const { meta } = error;
  if (
    isObject(meta) &&
    isObject(meta.driverAdapterError) &&
    isObject(meta.driverAdapterError.cause)
  ) {
    return meta.driverAdapterError.cause;
  }
  return undefined;
};

const prismaCode = (error: unknown): unknown => (isObject(error) ? error.code : undefined);

// The SQLSTATE behind an error, e.g. "40001", if it came from Postgres.
export const sqlState = (error: unknown): string | undefined => adapterCause(error)?.originalCode;

// Serialization failures (40001) and deadlocks (40P01). The whole transaction can be retried.
export const isRetryableConflict = (error: unknown): boolean => {
  const state = sqlState(error);
  return (
    prismaCode(error) === "P2034" ||
    adapterCause(error)?.kind === "TransactionWriteConflict" ||
    state === "40001" ||
    state === "40P01"
  );
};

// The unique index a 23505 violated, e.g. "Booking_venueId_idempotencyKey_key".
export const violatedUniqueIndex = (error: unknown): string | undefined => {
  if (prismaCode(error) !== "P2002" && sqlState(error) !== "23505") return undefined;
  return adapterCause(error)?.constraint?.index;
};

// Overload or an unreachable database: the request may well succeed if retried, so clients get a
// 503 instead of a 500.
const unavailableStates = new Set([
  "55P03", // lock_timeout
  "57014", // statement_timeout
  "57P01", // terminated by the server, e.g. Neon scaling a compute to zero
  "53300", // too many connections
]);
const unavailableCodes = new Set([
  "P1001", // can't reach the database server
  "P2024", // timed out waiting for a pooled connection
  "P2028", // transaction timed out or couldn't start in time
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
]);

export const isDatabaseUnavailable = (error: unknown): boolean => {
  const code = prismaCode(error);
  const state = sqlState(error);
  return (
    (typeof code === "string" && unavailableCodes.has(code)) ||
    (state !== undefined && unavailableStates.has(state))
  );
};
