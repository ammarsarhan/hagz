import { links } from "@hagz/contracts";
import { env } from "@/platform/config/env";

// Links for this environment, or undefined where WEB_URL isn't set. Callers fail with their channel's
// "unavailable" error rather than send a link to nowhere.
export const webLinks = env.WEB_URL ? links(env.WEB_URL) : undefined;
