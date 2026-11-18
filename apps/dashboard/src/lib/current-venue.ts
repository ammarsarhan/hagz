import { queryOptions, useQuery } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { queries } from "./queries";
import { queryClient } from "./query";
import { runningVenues } from "./venues";

// The venue the tabs are showing: the one last picked in the switcher (a long press on the Venue
// tab), else the first running venue the staff member belongs to. A venue still being set up isn't
// one of them: it has nothing to run yet.
//
// The pick is kept on the device, so the app opens where it was left. It's only a preference: a
// venue they've since left, or another account's on a shared phone, isn't on their list, and the
// first one is shown instead.
const KEY = "venue.current";

export const chosenVenue = queryOptions({
  // Not under ["staff", "venues"]: invalidating the venues never needs to read the device again.
  queryKey: ["device", "current-venue"],
  queryFn: async () => {
    try {
      return (await SecureStore.getItemAsync(KEY)) ?? null;
    } catch {
      // Storage unavailable: the first venue, as if nothing was picked.
      return null;
    }
  },
});

export const switchVenue = (venueId: string) => {
  queryClient.setQueryData(chosenVenue.queryKey, venueId);
  SecureStore.setItemAsync(KEY, venueId).catch(() => undefined);
};

export const useCurrentVenue = () => {
  const venues = useQuery(queries.venues);
  const chosen = useQuery(chosenVenue);
  const running = runningVenues(venues.data);
  // Undecided until the pick is read too, so the tabs never show the first venue for a frame.
  const venue = chosen.isPending
    ? undefined
    : (running.find((candidate) => candidate.id === chosen.data) ?? running[0]);
  return { venue, running, venues, ready: venues.isSuccess && !chosen.isPending };
};
