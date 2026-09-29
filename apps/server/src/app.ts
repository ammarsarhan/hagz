import { serve } from "@hono/node-server";
import { env } from "@/config/env";
import router from "@/index";

serve({ fetch: router.fetch, port: env.PORT }, (info) => {
  console.log(`[http] listening on :${info.port} (${env.APP_ENV})`);
});
