import * as SecureStore from "expo-secure-store";

// Moments celebrated once per venue on this device (a venue's approval), so opening the screen again
// doesn't throw confetti every time. Kept with the app's other device storage; nothing to sync,
// since replaying it on another phone is harmless.

const key = (moment: string, venueId: string) => `celebrated.${moment}.${venueId}`;

// True the first time it's asked for this moment and venue, and remembers that it was.
export const firstTime = async (moment: string, venueId: string) => {
  try {
    if (await SecureStore.getItemAsync(key(moment, venueId))) return false;
    await SecureStore.setItemAsync(key(moment, venueId), "1");
    return true;
  } catch {
    // Storage unavailable: skip it rather than celebrate on every visit.
    return false;
  }
};
