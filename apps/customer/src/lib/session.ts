import type { Session } from "@hagz/api";
import { auth } from "./api";
import { clearFavorites } from "./favorites";
import { leaveAuth, resetTo } from "./navigation";

// Signed in or up: keep the session, then back to what they were doing (or Home).
export const enterWithSession = async (session: Session) => {
  await auth.start(session);
  clearFavorites();
  leaveAuth();
};

// Signing out ends the session and leaves them browsing as a guest, on Home, with nothing
// signed-in underneath.
export const signOut = async () => {
  await auth.signOut();
  clearFavorites();
  resetTo("/home");
};
