import { auth } from "./api";
import { resetTo } from "./navigation";
import { queries } from "./queries";
import { queryClient } from "./query";

// Longest the way in waits on the server before showing the screen anyway (which then shows its own
// loading, or a retry when offline).
const LANDING_WAIT_MS = 3000;

// Where a signed-in staff member belongs: their venue's tabs, or first run when they're on no team
// yet. What those screens show is loaded into the cache on the way, so they open with it rather than
// a spinner, and the person never sees a screen they're about to leave.
export const landing = async (): Promise<"/venue" | "/home"> => {
  const loaded = Promise.all([
    queryClient.fetchQuery(queries.venues),
    queryClient.fetchQuery(queries.me),
    queryClient.fetchQuery(queries.invitations),
  ]).then(([venues]) => venues);
  const timedOut = new Promise<undefined>((resolve) => setTimeout(resolve, LANDING_WAIT_MS));
  const venues = await Promise.race([loaded.catch(() => undefined), timedOut]);
  // Not known (slow, offline): first run's page decides once it loads, and moves on if need be.
  return venues && venues.length > 0 ? "/venue" : "/home";
};

// Just signed in or up, or opened a link while signed in: straight to where they belong.
export const enterApp = async () => resetTo(await landing());

// Signing out also forgets everything fetched for that account, so the next one to sign in on this
// phone never sees it, not even for a moment while their own loads.
export const signOut = async () => {
  await auth.signOut();
  queryClient.clear();
};
