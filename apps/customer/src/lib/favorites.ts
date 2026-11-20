import { useEffect, useSyncExternalStore } from "react";
import { api, auth } from "./api";
import { hudMessage, send } from "./api-errors";

// The signed-in player's saved venues (PR 3.4): read once a session, then kept here as they save
// and remove, so every heart agrees. Saving and removing change this at once and undo it if the
// server refuses. Signing in or out empties it, so one account's saves never show for another.

let saved: ReadonlySet<string> = new Set();
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

const publish = (next: ReadonlySet<string>) => {
  saved = next;
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const clearFavorites = () => {
  loaded = false;
  loading = null;
  publish(new Set());
  // A heart already on screen (the venue page a guest signed in from) reads the new account's.
  if (listeners.size > 0) void load();
};

const load = () => {
  loading ??= (async () => {
    if (!(await auth.isSignedIn())) {
      clearFavorites();
      return;
    }
    const result = await send(api.GET("/v1/customers/me/favorites"));
    if (!result.ok) {
      loading = null;
      return;
    }
    loaded = true;
    publish(new Set(result.data.data.map((venue) => venue.id)));
  })();
  return loading;
};

// Whether a venue is saved; reads the list the first time any heart asks.
export const useIsFavorite = (venueId: string) => {
  useEffect(() => {
    if (!loaded) void load();
  }, []);
  return useSyncExternalStore(subscribe, () => saved.has(venueId));
};

// Saves or removes a venue; on failure the heart goes back and the reason comes back for the HUD.
export const toggleFavorite = async (venueId: string): Promise<string | null> => {
  const was = saved.has(venueId);
  const next = new Set(saved);
  if (was) next.delete(venueId);
  else next.add(venueId);
  publish(next);
  const params = { params: { path: { venueId } } };
  const result = await send(
    was
      ? api.DELETE("/v1/customers/me/favorites/{venueId}", params)
      : api.PUT("/v1/customers/me/favorites/{venueId}", params),
  );
  if (result.ok) return null;
  const back = new Set(saved);
  if (was) back.add(venueId);
  else back.delete(venueId);
  publish(back);
  return hudMessage(result.error);
};
