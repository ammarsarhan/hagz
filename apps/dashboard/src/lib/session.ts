import { auth } from "./api";
import { queryClient } from "./query";

// Signing out also forgets everything fetched for that account, so the next one to sign in on this
// phone never sees it, not even for a moment while their own loads.
export const signOut = async () => {
  await auth.signOut();
  queryClient.clear();
};
