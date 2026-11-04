import { router, type Href } from "expo-router";
import { queryClient } from "./query";

// Held while the app decides where it opens (lib/boot.ts), before there's a navigator to move: a
// session ended during that check just opens onboarding. Allowed otherwise, so a module reloaded in
// development can only ever let navigation through, never block it.
let held = false;
export const holdNavigation = (hold: boolean) => {
  held = hold;
};

// Crossing the signed-in boundary (signing in, signing up, signing out) starts a fresh history:
// nothing from the other side stays underneath to swipe back to.
export const resetTo = (href: Href) => {
  if (held) return;
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
};

// Signed out (by choice or by the server): to onboarding, then forget everything fetched for that
// account, so the next one to sign in on this phone never sees it. In that order: cleared first,
// the screens still showing would fetch again without a session on their way out.
export const leaveToOnboarding = () => {
  resetTo("/");
  requestAnimationFrame(() => queryClient.clear());
};
