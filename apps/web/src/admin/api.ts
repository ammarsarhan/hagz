import { createApiClient } from "@hagz/api";

// The admin session is httpOnly cookies the API sets through this site's own /v1 (next.config.ts),
// so requests go to the same origin and the client never sees a token.
export const { api } = createApiClient({
  baseUrl: "",
  audience: "admin",
  language: () => "en",
  // The session can't be renewed any more (it lasts 12 hours, or another admin ended it).
  onSessionEnded: () => window.location.assign("/admin/login"),
});
