"use client";

import type { AdminBooking, BookingStatus } from "@hagz/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// The Bookings page's data, with no design: a page of bookings at a time from the API, which filters
// by status and searches, so the table never holds every booking at once.

// The tabs' order: the life of a booking, then the ways it ends without being played.
export const STATUSES: BookingStatus[] = [
  "PENDING",
  "HELD",
  "UNCONFIRMED",
  "CONFIRMED",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
  "EXPIRED",
  "RELEASED",
  "RESCHEDULED",
];

export const statusLabel: Record<BookingStatus, string> = {
  PENDING: "Pending",
  HELD: "Awaiting payment",
  UNCONFIRMED: "Unconfirmed",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  NO_SHOW: "No-show",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  RELEASED: "Released",
  RESCHEDULED: "Moved",
};

// Green for bookings that stand; grey for waiting and ended.
export const statusTone = (status: BookingStatus) =>
  status === "CONFIRMED" || status === "COMPLETED" ? ("on" as const) : ("neutral" as const);

export const bookingHref = (id: string, tab?: "details" | "payments" | "history") =>
  `/admin/bookings/${id}${tab ? `/${tab}` : ""}`;

// "Tue 2 Dec 2026, 18:00–20:00": a booking's time where the venue is, whatever the admin's own
// timezone, so it reads as the player and the venue see it.
export const bookingTime = (startsAt: string, endsAt: string, timezone: string) => {
  const date = new Date(startsAt).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  });
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: timezone,
    });
  return `${date}, ${time(startsAt)}–${time(endsAt)}`;
};

// An instant where the venue is, e.g. when a hold expires.
export const venueDateTime = (iso: string, timezone: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  });

interface Loaded {
  bookings: AdminBooking[];
  nextCursor: string | null;
  counts: Record<BookingStatus, number>;
}

// How long typing pauses before the search goes to the API.
const SEARCH_DELAY_MS = 250;

export function useBookings(status: BookingStatus | undefined, query: string, venueId?: string) {
  const [data, setData] = useState<Loaded>();
  const [error, setError] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const hud = useHud();
  // Bumped by every new filter, so an answer to an older one (slower to arrive) is dropped.
  const latest = useRef(0);

  const fetchPage = useCallback(
    (cursor?: string) =>
      send(
        api.GET("/v1/admin/bookings", {
          params: { query: { venueId, status, q: query.trim() || undefined, cursor } },
        }),
      ),
    [venueId, status, query],
  );

  const fail = useCallback(
    (failure: unknown, retry: () => void) => {
      const text = message(failure);
      setError(text);
      if (notTheirFault(failure)) hud(text, { label: "Try again", run: retry });
    },
    [hud],
  );

  const load = useCallback(async () => {
    const request = ++latest.current;
    const result = await fetchPage();
    if (request !== latest.current) return;
    if (!result.ok) return fail(result.error, () => void load());
    setError(undefined);
    setData({
      bookings: result.data.data,
      nextCursor: result.data.nextCursor,
      counts: result.data.counts as Record<BookingStatus, number>,
    });
  }, [fetchPage, fail]);

  useEffect(() => {
    // A new search waits for typing to pause; a new tab loads straight away.
    const timer = setTimeout(() => void load(), query ? SEARCH_DELAY_MS : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  const loadMore = async () => {
    if (!data?.nextCursor || loadingMore) return;
    const request = latest.current;
    setLoadingMore(true);
    const result = await fetchPage(data.nextCursor);
    setLoadingMore(false);
    if (request !== latest.current) return;
    if (!result.ok) {
      const text = message(result.error);
      hud(
        text,
        notTheirFault(result.error)
          ? { label: "Try again", run: () => void loadMore() }
          : undefined,
      );
      return;
    }
    setData({
      bookings: [...data.bookings, ...result.data.data],
      nextCursor: result.data.nextCursor,
      counts: result.data.counts as Record<BookingStatus, number>,
    });
  };

  return { data, error, loadingMore, loadMore };
}
