import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/platform/config/env";
import { PrismaClient } from "@/generated/prisma/client";
import { logger } from "@/platform/logger/logger";

// Prisma's warnings go through pino. Its errors are not logged here: each one is thrown to the caller,
// and the ones nobody handles are logged once by the HTTP error handler (or the job runner). Expected
// errors, such as a retried deadlock or an idempotency race, stay quiet.
const createClient = () => {
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log: [{ emit: "event", level: "warn" }],
  });
  client.$on("warn", (event) => {
    logger.warn({ target: event.target }, event.message);
  });
  return client;
};

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

// Reused across hot reloads in dev so `tsx watch` doesn't open a new pool on every save.
export const prisma = globalForPrisma.prisma ?? createClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
