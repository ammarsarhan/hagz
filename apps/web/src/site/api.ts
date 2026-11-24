import type { components } from "@hagz/api";
import { cache } from "react";
import { apiUrl } from "@/lib/env";
import type { Locale } from "./words";

// The public pages read the API on the server, as a guest, in the page's language (the venue's name,
// area, amenities and description come back in it). Nothing is cached: free times change as players
// book.

export type PublicVenue = components["schemas"]["PublicVenue"];
export type PublicGround = components["schemas"]["PublicGround"];
export type VenueAvailability = components["schemas"]["VenueAvailability"];
export type FreeSlot = components["schemas"]["FreeSlot"];

const get = async <T>(path: string, locale: Locale = "en"): Promise<T | null> => {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { "Accept-Language": locale },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET ${path}: ${response.status}`);
  return (await response.json()) as T;
};

// Shared by generateMetadata and the page within one request.
export const getVenue = cache((slug: string, locale: Locale) =>
  get<PublicVenue>(`/v1/venues/${encodeURIComponent(slug)}`, locale),
);

// Free slots carry no words, so they're read in one language.
export const getAvailability = (slug: string, date: string) =>
  get<VenueAvailability>(`/v1/venues/${encodeURIComponent(slug)}/availability?date=${date}`);

export type SharedBooking = components["schemas"]["SharedBooking"];
export type Game = components["schemas"]["Game"];

// A booking's share link, read as a guest: what, when and where, never money or who.
export const getSharedBooking = cache((code: string, locale: Locale) =>
  get<SharedBooking>(`/v1/shared-bookings/${encodeURIComponent(code)}`, locale),
);

// Its open game, as a guest sees it: counts and the booker's first name, no players' names.
export const getGame = cache((id: string, locale: Locale) =>
  get<Game>(`/v1/games/${encodeURIComponent(id)}`, locale),
);
