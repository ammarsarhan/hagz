import { router, type Href } from "expo-router";

// Crossing the signed-in boundary (signing in, signing up, signing out) starts a fresh history:
// nothing from the other side stays underneath to swipe back to.
export const resetTo = (href: Href) => {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
};
