import { serve } from "@hono/node-server";
import { router } from "@/http/router";
import { env } from "@/platform/config/env";
import { handleShutdown } from "@/platform/lifecycle/shutdown";
import { logger } from "@/platform/logger/logger";

const server = serve({ fetch: router.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, "http listening");
});

// Stop accepting connections and wait for in-flight requests. close() also drops idle keep-alive
// connections, so it resolves as soon as the last request finishes.
handleShutdown(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    }),
);
