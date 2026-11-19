import * as SecureStore from "expo-secure-store";

// Onboarding shows until the player leaves it once (Skip, Create account or Sign in). Guests can
// browse without an account, so it can't hang off being signed in the way the staff app's does.
const KEY = "onboarding.seen";

export function hasSeenOnboarding(): boolean {
  return SecureStore.getItem(KEY) === "1";
}

export function markOnboardingSeen() {
  SecureStore.setItem(KEY, "1");
}

// Development only: show onboarding again on the next visit to the start screen.
export function resetOnboarding() {
  SecureStore.setItem(KEY, "0");
}
