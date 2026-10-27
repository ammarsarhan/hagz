import "dotenv/config";
import { z } from "zod";

const version = z.string().regex(/^\d+\.\d+\.\d+$/, "Expected major.minor.patch");

// A secret of at least 256 bits, written as base64url (generate one with
// `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).
const secret = z
  .string()
  .refine(
    (value) => Buffer.from(value, "base64url").length >= 32,
    "Expected 32+ random bytes, base64url",
  );

// An AES-256 key: exactly 32 random bytes, base64url (same command as above).
const aesKey = z
  .string()
  .transform((value) => Buffer.from(value, "base64url"))
  .refine((key) => key.length === 32, "Expected exactly 32 random bytes, base64url");

// Signing keys as `kid:secret` pairs, comma-separated. The first one signs; all of them verify, so a
// new key goes first and the old one stays listed until tokens signed with it have expired.
const signingKeys = z
  .string()
  .transform((value) => value.split(",").map((pair) => pair.trim()))
  .pipe(z.array(z.string().regex(/^[\w.-]+:.+$/, "Expected kid:secret pairs, comma-separated")))
  .transform((pairs) =>
    pairs.map((pair) => [pair.slice(0, pair.indexOf(":")), pair.slice(pair.indexOf(":") + 1)]),
  )
  .pipe(
    z
      .array(z.tuple([z.string(), secret]))
      .refine((keys) => new Set(keys.map(([kid]) => kid)).size === keys.length, "Duplicate kid"),
  )
  .transform((keys) => keys.map(([kid, key]) => ({ kid, key: Buffer.from(key, "base64url") })));

const schema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.url(),
  QUEUE_URL: z.url(),
  CACHE_URL: z.url(),
  // Older app builds get 426 APP_UPDATE_REQUIRED (http/app-version.ts).
  MIN_CUSTOMER_APP_VERSION: version.default("0.0.0"),
  MIN_DASHBOARD_APP_VERSION: version.default("0.0.0"),
  // The header the edge proxy sets to the caller's address, used for per-IP rate limits. Only set it
  // once a spoofed value has been shown to be overwritten in that environment; unset, the socket
  // address is used (behind a proxy that is the proxy, so every client shares one limit).
  CLIENT_IP_HEADER: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Expected a lowercase header name, e.g. x-real-ip")
    .optional(),
  // No defaults for secrets: a missing or short one stops the process instead of running insecurely.
  JWT_SIGNING_KEYS: signingKeys,
  OTP_PEPPER: secret,
  // Encrypts admins' authenticator secrets (platform/crypto/totp.ts).
  TOTP_ENCRYPTION_KEY: aesKey,
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // console, not the logger: the logger is configured from these variables.
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
