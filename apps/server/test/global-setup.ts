import { execFileSync } from "node:child_process";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer } from "@testcontainers/redis";

// The same images as infra/docker-compose.yml and production: tests run against real Postgres
// (with PostGIS) and Redis, never mocks, because the invariants live in the database.
export default async function setup() {
  const [postgres, redis] = await Promise.all([
    new PostgreSqlContainer("imresamu/postgis:18-3.6")
      .withDatabase("template_hagz")
      .withUsername("hagz")
      .withPassword("hagz")
      .start(),
    new RedisContainer("redis:7").start(),
  ]);

  const template = postgres.getConnectionUri();
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: template, DIRECT_DATABASE_URL: template },
    stdio: "pipe",
  });

  // Inherited by every test worker. Set explicitly so a developer's .env can't leak in (dotenv
  // never overrides variables that are already set).
  Object.assign(process.env, {
    TEST_POSTGRES_URL: template,
    QUEUE_URL: redis.getConnectionUrl(),
    CACHE_URL: `${redis.getConnectionUrl()}/1`,
    APP_ENV: "development",
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    MIN_CUSTOMER_APP_VERSION: "1.4.0",
    MIN_DASHBOARD_APP_VERSION: "0.0.0",
  });

  return async () => {
    await Promise.all([postgres.stop(), redis.stop()]);
  };
}
