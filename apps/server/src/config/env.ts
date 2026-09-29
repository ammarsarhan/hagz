import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_QUEUE_URL: z.string().url(),
  REDIS_CACHE_URL: z.string().url(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
