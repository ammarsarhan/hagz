import { createHash, randomBytes } from "node:crypto";

// Opaque secrets handed to clients (refresh tokens, verification tokens, invitation links): 256 bits,
// URL-safe. Only their SHA-256 is stored, so a database leak doesn't leak usable tokens. A plain hash
// is enough here (unlike passwords and codes): the input is random, so there is nothing to guess.
export const randomToken = (): string => randomBytes(32).toString("base64url");

export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("base64url");
