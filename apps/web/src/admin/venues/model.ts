"use client";

import type { AdminVenue, VenueStatus } from "@hagz/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// The Venues page's data, with no design: a page of venues at a time from the API, which filters by
// status and searches, so the table never holds every venue at once.

export const STATUSES: VenueStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "PROVISIONING",
  "LIVE",
  "MAINTENANCE",
];

export const statusLabel: Record<VenueStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PROVISIONING: "Provisioning",
  LIVE: "Live",
  MAINTENANCE: "Maintenance",
};

interface Loaded {
  venues: AdminVenue[];
  nextCursor: string | null;
  counts: Record<VenueStatus, number>;
}

// How long typing pauses before the search goes to the API.
const SEARCH_DELAY_MS = 250;

export function useVenues(status: VenueStatus | undefined, query: string) {
  const [data, setData] = useState<Loaded>();
  const [error, setError] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const hud = useHud();
  // Bumped by every new filter, so an answer to an older one (slower to arrive) is dropped.
  const latest = useRef(0);

  const fetchPage = useCallback(
    (cursor?: string) =>
      send(
        api.GET("/v1/admin/venues", {
          params: { query: { status, q: query.trim() || undefined, cursor } },
        }),
      ),
    [status, query],
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
      venues: result.data.data,
      nextCursor: result.data.nextCursor,
      counts: result.data.counts as Record<VenueStatus, number>,
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
      venues: [...data.venues, ...result.data.data],
      nextCursor: result.data.nextCursor,
      counts: result.data.counts as Record<VenueStatus, number>,
    });
  };

  return { data, error, loadingMore, loadMore };
}
