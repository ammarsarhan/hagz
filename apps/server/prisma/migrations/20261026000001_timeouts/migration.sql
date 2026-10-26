-- Server-side defaults for every new session. Neon's pooler (PgBouncer) rejects these as connection
-- parameters, so they are set on the database instead. They apply to the app and to migrations; a
-- migration or worker job that needs longer (e.g. building an index on a large table) raises it for
-- itself with SET (or SET LOCAL inside its transaction).
--
-- statement_timeout: no single statement runs past 5 s. This is what actually stops work: the HTTP
-- timeout (15 s) and Prisma's transaction timeout (10 s) only stop waiting for it.
-- lock_timeout: give up after waiting 2 s for a lock, so a migration's ALTER TABLE can't queue every
-- request behind it, and a hot row fails fast instead of piling up connections.
-- idle_in_transaction_session_timeout: a transaction left open by a crashed or stuck client is rolled
-- back after 30 s instead of holding its locks (Neon's default is 5 minutes).
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET statement_timeout = %L', current_database(), '5s');
  EXECUTE format('ALTER DATABASE %I SET lock_timeout = %L', current_database(), '2s');
  EXECUTE format('ALTER DATABASE %I SET idle_in_transaction_session_timeout = %L', current_database(), '30s');
END
$$;
