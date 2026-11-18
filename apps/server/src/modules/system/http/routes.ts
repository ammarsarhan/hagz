import { createRouter } from "@/platform/http/router";
import { readHistory } from "../application/history";
import { jobsStatus, retryJob } from "../application/jobs";
import { systemStatus } from "../application/status";
import * as route from "./definitions/system";

export const systemRoutes = createRouter()
  .openapi(route.status, async (c) => {
    return c.json(await systemStatus(), 200);
  })
  .openapi(route.history, async (c) => {
    return c.json({ samples: await readHistory() }, 200);
  })
  .openapi(route.jobs, async (c) => c.json(await jobsStatus(), 200))
  .openapi(route.retryJob, async (c) => {
    const { queue, jobId } = c.req.valid("param");
    await retryJob(queue, jobId);
    return c.body(null, 204);
  });
