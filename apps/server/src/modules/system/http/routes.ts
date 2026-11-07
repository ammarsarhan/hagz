import { createRouter } from "@/platform/http/router";
import { readHistory } from "../application/history";
import { systemStatus } from "../application/status";
import * as route from "./definitions/system";

export const systemRoutes = createRouter()
  .openapi(route.status, async (c) => {
    return c.json(await systemStatus(), 200);
  })
  .openapi(route.history, async (c) => {
    return c.json({ samples: await readHistory() }, 200);
  });
