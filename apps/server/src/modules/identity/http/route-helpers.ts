import type { Context } from "hono";
import { clientIp } from "@/platform/rate-limit/rate-limit";

// The device a sign-in or sign-up came from, recorded on its session.
export const device = (c: Context) => ({
  ip: clientIp(c),
  userAgent: c.req.header("User-Agent"),
});
