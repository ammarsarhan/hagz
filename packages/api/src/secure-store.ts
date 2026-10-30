import * as SecureStore from "expo-secure-store";
import type { SessionStore, StoredSession } from "./client";

// The Keychain on iOS and the Keystore on Android. AFTER_FIRST_UNLOCK so a refresh can run while the
// phone is locked (a push opening the app); THIS_DEVICE_ONLY so a backup restored onto another phone
// doesn't carry the session with it.
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const secureSessionStore = (key = "hagz.session"): SessionStore => ({
  load: async () => {
    const stored = await SecureStore.getItemAsync(key, options);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as StoredSession;
    } catch {
      return null;
    }
  },
  save: (session) => SecureStore.setItemAsync(key, JSON.stringify(session), options),
  clear: () => SecureStore.deleteItemAsync(key, options),
});
