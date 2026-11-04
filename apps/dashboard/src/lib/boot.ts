import * as SplashScreen from "expo-splash-screen";
import { auth } from "./api";
import { navigationReady } from "./navigation";
import { landing } from "./session";

// The splash screen stays up until the app knows where to open: onboarding, or (signed in from an
// earlier launch) the venue's tabs or first run, with what they show already loaded. So nothing is
// drawn that's about to be left: no onboarding, spinner or first run flashing on the way in.
void SplashScreen.preventAutoHideAsync();
// Fades out over the first screen, as most apps open, rather than cutting to it.
SplashScreen.setOptions({ fade: true, duration: 250 });

let signedInTarget: "/venue" | "/home" | null = null;

export const boot = async () => {
  try {
    if (!(await auth.isSignedIn())) return;
    const target = await landing();
    // The saved session may have ended (revoked, or its account gone) while loading: onboarding.
    if (await auth.isSignedIn()) signedInTarget = target;
  } finally {
    // Before the navigator draws, not after: screens (an invitation link opened from cold) navigate
    // from their first effects, which run before the root layout's.
    navigationReady();
  }
};

// For onboarding, once: where a signed-in person goes instead. Cleared, so signing out later and
// coming back to onboarding shows it.
export const takeSignedInTarget = () => {
  const target = signedInTarget;
  signedInTarget = null;
  return target;
};

// After the first screen has drawn, so there's no blank frame between the splash and it. `then`
// runs once it's settled: from there, screens animate in as usual.
export const hideSplash = (then: () => void) => {
  requestAnimationFrame(() => {
    void SplashScreen.hideAsync();
    requestAnimationFrame(then);
  });
};
