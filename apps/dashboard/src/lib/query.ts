import { isProblem } from "@hagz/api";
import { QueryClient } from "@tanstack/react-query";

// One cache for the app. What's fetched stays fresh until something says otherwise: a write that
// changes it updates or invalidates it, so opening a screen again doesn't ask the server again. The
// cache belongs to whoever is signed in, so signing out clears it (see `signOut` in session.ts).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      // Kept while signed in, even with no screen showing it (the account page, closed and reopened).
      gcTime: Infinity,
      // Not again for an answer the server meant (a 4xx won't change by asking twice); twice more
      // for being offline or the server failing.
      retry: (failures, error) => failures < 2 && (!isProblem(error) || error.status >= 500),
    },
  },
});
