import "dotenv/config";
import { z } from "zod";

const version = z.string().regex(/^\d+\.\d+\.\d+$/, "Expected major.minor.patch");

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
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // console, not the logger: the logger is configured from these variables.
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
