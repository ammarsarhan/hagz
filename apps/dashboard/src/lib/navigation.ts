import { router, type Href } from "expo-router";

// Set once the root layout draws its navigator. Before that (while the splash decides where the app
// opens) there's nothing to navigate, and a session ended during that check just opens onboarding.
let ready = false;
export const navigationReady = () => {
  ready = true;
};

// Crossing the signed-in boundary (signing in, signing up, signing out) starts a fresh history:
// nothing from the other side stays underneath to swipe back to.
export const resetTo = (href: Href) => {
  if (!ready) return;
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
};
