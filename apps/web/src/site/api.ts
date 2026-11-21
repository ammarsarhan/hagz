import type { components } from "@hagz/api";
import { cache } from "react";
import { apiUrl } from "@/lib/env";

// The public pages read the API on the server, as a guest, in English (the web is English only for
// now). Nothing is cached: free times change as players book.

export type PublicVenue = components["schemas"]["PublicVenue"];
export type PublicGround = components["schemas"]["PublicGround"];
export type VenueAvailability = components["schemas"]["VenueAvailability"];
export type FreeSlot = components["schemas"]["FreeSlot"];

const get = async <T>(path: string): Promise<T | null> => {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { "Accept-Language": "en" },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET ${path}: ${response.status}`);
  return (await response.json()) as T;
};

// Shared by generateMetadata and the page within one request.
export const getVenue = cache((slug: string) =>
  get<PublicVenue>(`/v1/venues/${encodeURIComponent(slug)}`),
);

export const getAvailability = (slug: string, date: string) =>
  get<VenueAvailability>(`/v1/venues/${encodeURIComponent(slug)}/availability?date=${date}`);
