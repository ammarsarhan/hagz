import { prisma } from "@/platform/db/prisma";

// Empties every table the migrations created (not extension tables such as PostGIS's
// spatial_ref_sys). Call it in beforeEach of files that write.
export const resetDatabase = async () => {
  const tables = await prisma.$queryRaw<{ name: string }[]>`
    SELECT format('%I', c.relname) AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_prisma_migrations'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')`;
  if (tables.length === 0) return;
  // The database's 5 s statement_timeout (migration 20261026000001_timeouts) guards requests, not
  // this: with every worker truncating while turbo builds the apps beside it, one TRUNCATE ran past
  // it (2026-11-27). Lifted for this statement only.
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL statement_timeout = '60s'`),
    prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => t.name).join(", ")} CASCADE`),
  ]);
};
