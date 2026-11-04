import { env } from "@/platform/config/env";

// This process: the commit it was deployed from (null locally) and when it started. Read by the admin
// home for the server, and sent in the worker's heartbeat for the worker.
export const buildInfo = {
  commit: env.RAILWAY_GIT_COMMIT_SHA ?? null,
  startedAt: new Date(),
} as const;
