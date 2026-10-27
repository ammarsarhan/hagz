import pg from "pg";
import { afterAll } from "vitest";

// One database per worker, cloned from the migrated template (milliseconds), so test files run in
// parallel without seeing each other's rows. Runs before each test file imports any app code.
const templateUrl = new URL(process.env.TEST_POSTGRES_URL ?? "");
const template = templateUrl.pathname.slice(1);
const database = `test_${process.env.VITEST_POOL_ID ?? "0"}`;

const admin = new pg.Client({
  connectionString: Object.assign(new URL(templateUrl), { pathname: "/postgres" }).href,
});
await admin.connect();
try {
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
  if (exists.rowCount === 0) {
    await admin.query(
      `CREATE DATABASE ${admin.escapeIdentifier(database)} TEMPLATE ${admin.escapeIdentifier(template)}`,
    );
    // A template copy doesn't carry database-level settings (the timeouts from migration
    // 20261026000001_timeouts, the image's search_path), so copy them across.
    const settings = await admin.query<{ setting: string }>(
      `SELECT unnest(s.setconfig) AS setting FROM pg_db_role_setting s
       JOIN pg_database d ON d.oid = s.setdatabase WHERE d.datname = $1 AND s.setrole = 0`,
      [template],
    );
    for (const { setting } of settings.rows) {
      const separator = setting.indexOf("=");
      const name = setting.slice(0, separator);
      // set_config parses the value like Postgres parses the setting itself (lists such as
      // search_path included); FROM CURRENT then stores it on the new database.
      await admin.query("SELECT set_config($1, $2, false)", [name, setting.slice(separator + 1)]);
      await admin.query(
        `ALTER DATABASE ${admin.escapeIdentifier(database)} SET ${admin.escapeIdentifier(name)} FROM CURRENT`,
      );
    }
  }
} finally {
  await admin.end();
}

process.env.DATABASE_URL = Object.assign(new URL(templateUrl), { pathname: `/${database}` }).href;

// Redis too: one logical database per worker (1-8, see maxWorkers in vitest.config.ts), so a file can
// wipe its own Redis state without touching a file running in parallel. Queue and cache share it here.
const redisUrl = `${process.env.TEST_REDIS_URL ?? ""}/${process.env.VITEST_POOL_ID ?? "1"}`;
process.env.QUEUE_URL = redisUrl;
process.env.CACHE_URL = redisUrl;

// Each test file gets fresh module instances, so close what this one opened.
afterAll(async () => {
  const [{ prisma }, { queueConnection, cache }] = await Promise.all([
    import("@/platform/db/prisma"),
    import("@/platform/redis/connections"),
  ]);
  await prisma.$disconnect();
  queueConnection.disconnect();
  cache.disconnect();
});
