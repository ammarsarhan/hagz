import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";
import { send } from "./api-errors";

// The answer, or the failure thrown, which is how TanStack Query expects a query to fail. The error
// is the same problem (or network failure) `send` gives screens, so the messages don't change.
const fetched = async <T>(request: Promise<{ data?: T; error?: unknown }>): Promise<T> => {
  const result = await send(request);
  if (!result.ok) throw result.error;
  return result.data;
};

// The signed-in staff member's reads, shared by every screen that shows them. Keys sit under
// "staff" so a write can invalidate one, or the whole lot.
export const queries = {
  me: queryOptions({
    queryKey: ["staff", "me"],
    queryFn: () => fetched(api.GET("/v1/staff/me")),
  }),
  venues: queryOptions({
    queryKey: ["staff", "venues"],
    queryFn: async () => (await fetched(api.GET("/v1/staff/venues"))).data,
  }),
  invitations: queryOptions({
    queryKey: ["staff", "invitations"],
    queryFn: async () => (await fetched(api.GET("/v1/staff/invitations"))).data,
  }),
  // A venue's setup checklist. Refetched when an item is finished, so the progress ring and the
  // "Send for review" button follow the work. A save should invalidate `venues` (a prefix of this
  // key, so both refetch): the draft card's name and "Last updated" come from that list.
  setup: (venueId: string) =>
    queryOptions({
      queryKey: ["staff", "venues", venueId, "setup"],
      queryFn: () =>
        fetched(api.GET("/v1/staff/venues/{venueId}/setup", { params: { path: { venueId } } })),
    }),
};

// Reference data: the same for everyone and changed by admins only, so it's fetched once and kept
// for the session rather than refetched behind every screen that needs it.
const REFERENCE = { staleTime: Infinity, gcTime: Infinity } as const;

export const reference = {
  marketplaces: queryOptions({
    queryKey: ["marketplaces"],
    queryFn: async () => (await fetched(api.GET("/v1/marketplaces"))).data,
    ...REFERENCE,
  }),
  // A marketplace's areas, flat (build the tree from parentId). Used to file a new venue under the
  // area its pin falls in (lib/areas.ts).
  locations: (code: string) =>
    queryOptions({
      queryKey: ["marketplaces", code, "locations"],
      queryFn: async () =>
        (
          await fetched(
            api.GET("/v1/marketplaces/{code}/locations", { params: { path: { code } } }),
          )
        ).data,
      ...REFERENCE,
    }),
};
