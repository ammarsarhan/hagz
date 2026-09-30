import { serve } from "@hono/node-server";
import { env } from "@/config/env";
import router from "@/index";

const server = serve({ fetch: router.fetch, port: env.PORT }, (info) => {
  console.log(`[http] listening on :${info.port} (${env.APP_ENV})`);
});

// Node ignores SIGTERM by default when it runs as PID 1 in a container.
const shutdown = () => server.close(() => process.exit(0));

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
