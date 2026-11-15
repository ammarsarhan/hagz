import * as SplashScreen from "expo-splash-screen";
import { auth } from "./api";
import { holdNavigation, setSignedInTarget } from "./navigation";
import { landing } from "./session";

// The splash screen stays up until the app knows where to open: onboarding, or (signed in from an
// earlier launch) the venue's tabs or first run, with what they show already loaded. So nothing is
// drawn that's about to be left: no onboarding, spinner or first run flashing on the way in.
void SplashScreen.preventAutoHideAsync();
// Fades out over the first screen, as most apps open, rather than cutting to it.
SplashScreen.setOptions({ fade: true, duration: 250 });

// Whether a session is stored. Reading the Keychain can fail now and then (iOS, mostly on
// development builds): a failure is tried once more, and a second one forgets whatever is stored,
// so onboarding showing always means signed out, never "couldn't tell" with a session still there.
const hasStoredSession = async () => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await auth.isSignedIn();
    } catch {
      // Tried again below, or forgotten.
    }
  }
  await auth.forget().catch(() => undefined);
  return false;
};

export const boot = async () => {
  holdNavigation(true);
  try {
    if (!(await hasStoredSession())) return;
    const target = await landing();
    // The saved session may have ended (revoked, or its account gone) while loading: onboarding.
    if (await auth.isSignedIn()) setSignedInTarget(target);
  } finally {
    // Before the navigator draws, not after: screens (an invitation link opened from cold) navigate
    // from their first effects, which run before the root layout's.
    holdNavigation(false);
  }
};

// After the first screen has drawn, so there's no blank frame between the splash and it. `then`
// runs once it's settled: from there, screens animate in as usual.
export const hideSplash = (then: () => void) => {
  requestAnimationFrame(() => {
    void SplashScreen.hideAsync();
    requestAnimationFrame(then);
  });
};
