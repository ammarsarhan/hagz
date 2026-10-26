import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["test/**/*.test.ts"],
    // Starts Postgres and Redis once and migrates a template database.
    globalSetup: ["test/global-setup.ts"],
    // Gives each worker its own copy of that database before any app code is imported.
    setupFiles: ["test/setup.ts"],
    // Concurrency tests wait on real locks and retries.
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
