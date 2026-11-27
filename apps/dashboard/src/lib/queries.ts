import { queryOptions, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { api } from "./api";
import { send } from "./api-errors";
import type { Coordinates } from "./places";

// The answer, or the failure thrown, which is how TanStack Query expects a query to fail. The error
// is the same problem (or network failure) `send` gives screens, so the messages don't change.
export const fetched = async <T>(request: Promise<{ data?: T; error?: unknown }>): Promise<T> => {
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
  // A venue's setup checklist. Refetched when an item may have been finished, so the progress ring
  // and the "Send for review" button follow the work (see afterVenueWrite).
  setup: (venueId: string) =>
    queryOptions({
      queryKey: ["staff", "venues", venueId, "setup"],
      queryFn: () =>
        fetched(api.GET("/v1/staff/venues/{venueId}/setup", { params: { path: { venueId } } })),
    }),
  // The venue's photos, cover first (pending uploads included, as PENDING).
  photos: (venueId: string) =>
    queryOptions({
      queryKey: ["staff", "venues", venueId, "photos"],
      queryFn: async () =>
        (
          await fetched(
            api.GET("/v1/staff/venues/{venueId}/photos", { params: { path: { venueId } } }),
          )
        ).data,
    }),
  // The venue's grounds in their order (deleted ones left out), named in the app's language.
  grounds: (venueId: string) =>
    queryOptions({
      queryKey: ["staff", "venues", venueId, "grounds"],
      queryFn: async () =>
        (
          await fetched(
            api.GET("/v1/staff/venues/{venueId}/grounds", { params: { path: { venueId } } }),
          )
        ).data,
    }),
  // The venue layout, or the empty grid it would start as (`saved` false), and which grounds
  // aren't on it yet.
  layout: (venueId: string) =>
    queryOptions({
      queryKey: ["staff", "venues", venueId, "layout"],
      queryFn: () =>
        fetched(api.GET("/v1/staff/venues/{venueId}/layout", { params: { path: { venueId } } })),
    }),
  // A ground's weekly hours, as the API stores them (lib/hours.ts reads them as days).
  schedule: (venueId: string, groundId: string) =>
    queryOptions({
      queryKey: ["staff", "venues", venueId, "grounds", groundId, "schedule"],
      queryFn: async () =>
        (
          await fetched(
            api.GET("/v1/staff/venues/{venueId}/grounds/{groundId}/schedule", {
              params: { path: { venueId, groundId } },
            }),
          )
        ).days,
    }),
  // Everything a setup item's screen edits, in one read. Each save answers with the venue as it now
  // is, which goes straight back in here (lib/venue-edit.ts).
  venue: (venueId: string) =>
    queryOptions({
      queryKey: ["staff", "venues", venueId, "detail"],
      queryFn: () =>
        fetched(api.GET("/v1/staff/venues/{venueId}", { params: { path: { venueId } } })),
    }),
};

// After a write to one venue: refetch what it changed, and nothing else. Every key under a venue
// starts with the list's key, so invalidating that prefix (as saves used to) refetched every read
// of every venue still mounted anywhere in the stack, the answer a save had just put in the cache
// included. Only the owner edits a draft, so this phone's own answers are trusted as they are.
//
// - The list, always: every write moves the venue's lastActivityAt (the draft card's "Last
//   updated").
// - The checklist, unless the write can't finish an item (a settings toggle, a photo reorder).
// - `also`: exactly the other reads the write changed (grounds, a ground's schedule).
//
// Never the one the save's answer was just written into. Resolves when all of them are back.
export const afterVenueWrite = (
  queryClient: QueryClient,
  venueId: string,
  { checklist = true, also = [] }: { checklist?: boolean; also?: QueryKey[] } = {},
) =>
  Promise.all(
    [queries.venues.queryKey, ...(checklist ? [queries.setup(venueId).queryKey] : []), ...also].map(
      (queryKey) => queryClient.invalidateQueries({ queryKey, exact: true }),
    ),
  );

// After a change that reaches what's booked on a ground (new hours, deleting it; user, 2026-11-27):
// requests declined, regulars' waiting weeks let go and their end set, hours freed or closed. Every
// screen showing them reads again: the calendar's slots and bookings, the requests, booking pages,
// the regulars list and each regular's page, and customers' bookings.
export const afterBookedChange = (queryClient: QueryClient, venueId: string) =>
  Promise.all(
    ["slots", "bookings", "regulars", "customers"].map((part) =>
      queryClient.invalidateQueries({ queryKey: ["staff", "venues", venueId, part] }),
    ),
  );

// Reference data: the same for everyone and changed by admins only, so it's fetched once and kept
// for the session rather than refetched behind every screen that needs it.
const REFERENCE = { staleTime: Infinity, gcTime: Infinity } as const;

export const reference = {
  marketplaces: queryOptions({
    queryKey: ["marketplaces"],
    queryFn: async () => (await fetched(api.GET("/v1/marketplaces"))).data,
    ...REFERENCE,
  }),
  // What a venue in this marketplace can offer, named in the app's language.
  amenities: (code: string) =>
    queryOptions({
      queryKey: ["marketplaces", code, "amenities"],
      queryFn: async () =>
        (
          await fetched(
            api.GET("/v1/marketplaces/{code}/amenities", { params: { path: { code } } }),
          )
        ).data,
      ...REFERENCE,
    }),
};

// Areas a venue can be filed under, asked of the API rather than worked out in the app: it suggests
// the area nearest the pin and searches by name in either language (docs/onboarding.md). Areas
// change rarely, so an answer is kept a few minutes. Points are rounded to about a metre, so the
// map settling on the same spot twice is one request.
const AREAS = { staleTime: 5 * 60_000 } as const;
const rounded = ({ latitude, longitude }: Coordinates) => ({
  latitude: Number(latitude.toFixed(5)),
  longitude: Number(longitude.toFixed(5)),
});

export const areas = {
  // The area to suggest for the pin, or null when none is near enough.
  nearest: (code: string, pin: Coordinates) =>
    queryOptions({
      queryKey: ["marketplaces", code, "areas", "nearest", rounded(pin)],
      queryFn: async () =>
        (
          await fetched(
            api.GET("/v1/marketplaces/{code}/areas/nearest", {
              params: { path: { code }, query: rounded(pin) },
            }),
          )
        ).area,
      ...AREAS,
    }),
  // What's typed, nearest the pin first; with nothing typed, simply the nearest.
  search: (code: string, q: string, pin: Coordinates) =>
    queryOptions({
      queryKey: ["marketplaces", code, "areas", { q, ...rounded(pin) }],
      queryFn: async () =>
        (
          await fetched(
            api.GET("/v1/marketplaces/{code}/areas", {
              params: { path: { code }, query: { ...(q ? { q } : {}), ...rounded(pin) } },
            }),
          )
        ).data,
      ...AREAS,
    }),
};
