import { router, type Href } from "expo-router";

// Opens a screen on top, once: a second tap while the first push is still sliding in (a quick
// double tap on See times) would stack the same screen twice. Every push in the app goes through
// here, never router.push directly. Longer than the push animation, shorter than a deliberate tap.
const PUSH_LOCK_MS = 600;
let lastPush = 0;

export const push = (href: Href) => {
  const now = Date.now();
  if (now - lastPush < PUSH_LOCK_MS) return;
  lastPush = now;
  router.push(href);
};

// Crossing the signed-in boundary (signing in, signing up, signing out) starts a fresh history:
// nothing from the other side stays underneath to swipe back to.
export const resetTo = (href: Href) => {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
};

// Guests browse freely and are asked to sign in only when something needs an account (booking, a
// favourite). The screen that asked is remembered here, and signing in or up returns to it,
// closing the account screens on top of it. From onboarding's Create account there's nothing to
// return to, so they land on Home.
let returnTo: Href | null = null;

export const signInFrom = (screen: Href) => {
  returnTo = screen;
};

export const leaveAuth = () => {
  const target = returnTo;
  returnTo = null;
  if (target) router.dismissTo(target);
  else resetTo("/home");
};
