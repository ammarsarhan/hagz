import { createApiClient } from "@hagz/api";

// The admin session is httpOnly cookies the API sets through this site's own /v1 (next.config.ts),
// so requests go to the same origin and the client never sees a token.
const signedOutPages = ["/admin/login", "/admin/invitations/accept"];

export const { api } = createApiClient({
  baseUrl: "",
  audience: "admin",
  language: () => "en",
  // The session can't be renewed any more (it lasts 12 hours, or another admin ended it). Pages that
  // work signed out stay put, or checking for a session there would reload them forever.
  onSessionEnded: () => {
    if (!signedOutPages.some((path) => window.location.pathname.startsWith(path))) {
      window.location.assign("/admin/login");
    }
  },
});
