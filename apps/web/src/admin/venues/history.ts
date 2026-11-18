"use client";

import type { components } from "@hagz/api";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";

// A venue's History tab's data, with no design: everything that happened to it, newest first, a page
// at a time from the API (GET /admin/venues/{id}/history); Show more fetches the next.

export type VenueHistoryEvent = components["schemas"]["VenueHistoryEvent"];

interface Loaded {
  events: VenueHistoryEvent[];
  next: string | null;
}

export function useVenueHistory(venueId: string) {
  const [data, setData] = useState<Loaded>();
  const [error, setError] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const hud = useHud();

  const fetchPage = useCallback(
    (cursor?: string) =>
      send(
        api.GET("/v1/admin/venues/{id}/history", {
          params: { path: { id: venueId }, query: { cursor } },
        }),
      ),
    [venueId],
  );

  const load = useCallback(async () => {
    const result = await fetchPage();
    if (!result.ok) {
      const text = message(result.error);
      setError(text);
      if (notTheirFault(result.error)) hud(text, { label: "Try again", run: () => void load() });
      return;
    }
    setError(undefined);
    setData({ events: result.data.data, next: result.data.next });
  }, [fetchPage, hud]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!data?.next || loadingMore) return;
    setLoadingMore(true);
    const result = await fetchPage(data.next);
    setLoadingMore(false);
    if (!result.ok) {
      hud(
        message(result.error),
        notTheirFault(result.error)
          ? { label: "Try again", run: () => void loadMore() }
          : undefined,
      );
      return;
    }
    setData({ events: [...data.events, ...result.data.data], next: result.data.next });
  };

  return { data, error, loadingMore, loadMore };
}

// What each event is called in the table. Types are strings in the API (modules add their own), so an
// unknown one still reads as words: "SOMETHING_NEW" becomes "Something new".
const labels: Record<string, string> = {
  VENUE_CREATED: "Venue created",
  VENUE_DETAILS_CHANGED: "Details changed",
  VENUE_LOCATION_CHANGED: "Location changed",
  VENUE_AREA_SET: "Area set",
  VENUE_TRANSLATION_CHANGED: "Translation changed",
  VENUE_SETTINGS_CHANGED: "Settings changed",
  VENUE_COMMISSION_CHANGED: "Commission changed",
  VENUE_AMENITIES_CHANGED: "Amenities changed",
  VENUE_PHOTO_ADDED: "Photo added",
  VENUE_PHOTO_REMOVED: "Photo removed",
  VENUE_PHOTOS_REORDERED: "Photos reordered",
  GROUND_ADDED: "Ground added",
  GROUND_CHANGED: "Ground changed",
  GROUND_REMOVED: "Ground removed",
  GROUNDS_REORDERED: "Grounds reordered",
  GROUND_SCHEDULE_CHANGED: "Hours changed",
  GROUND_SCHEDULE_COPIED: "Hours copied",
  SLOTS_BLOCKED: "Slots blocked",
  SLOTS_UNBLOCKED: "Slots unblocked",
  SLOT_PRICES_SET: "Slot prices set",
  SLOTS_ADDED: "Slots added",
  SLOTS_RESET: "Slots reset to the schedule",
  VENUE_LAYOUT_CHANGED: "Layout changed",
  VENUE_SUBMITTED: "Sent for review",
  VENUE_WITHDRAWN: "Withdrawn from review",
  VENUE_APPROVED: "Approved",
  VENUE_REJECTED: "Sent back",
  VENUE_LIVE: "Went live",
  VENUE_PAUSED: "Paused",
  VENUE_RESUMED: "Resumed",
  TAX_NUMBER_CHECKED: "Tax number checked",
  STAFF_INVITED: "Staff invited",
  STAFF_INVITATION_REVOKED: "Invitation revoked",
  STAFF_INVITATION_DECLINED: "Invitation declined",
  STAFF_JOINED: "Staff joined",
  STAFF_REMOVED: "Removed from staff",
  OWNERSHIP_TRANSFERRED: "Ownership transferred",
  STAFF_SUSPENDED: "Account suspended",
  STAFF_REACTIVATED: "Account reactivated",
  STAFF_BANNED: "Account banned",
  STAFF_PERMISSIONS_CHANGED: "Permissions changed",
  STAFF_RESTRICTED_AFTER_PASSWORD_RESET: "Restricted after password reset",
};

export const eventLabel = (type: string) => {
  const known = labels[type];
  if (known) return known;
  const words = type.toLowerCase().replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

// "8 Nov 2026, 15:12", in the admin's own time zone.
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// A row of the History table: one event, or a run of the same event back to back (a ground's hours
// saved five times in a row), which opens like a location's sublocations to show each one.
export type HistoryRow =
  | { kind: "event"; id: string; event: VenueHistoryEvent }
  | { kind: "run"; id: string; type: string; events: VenueHistoryEvent[]; children: HistoryRow[] };

// Only neighbours are joined, so the table still reads in order: two "Ground changed" with a photo
// between them stay apart. A run is named after its first (newest) event, so it keeps its id, and
// stays open, when Show more adds older events to it.
export const historyRows = (events: VenueHistoryEvent[]): HistoryRow[] => {
  const runs: VenueHistoryEvent[][] = [];
  for (const event of events) {
    const last = runs.at(-1);
    if (last?.[0]?.type === event.type) last.push(event);
    else runs.push([event]);
  }
  return runs.map((run) => {
    const [first] = run as [VenueHistoryEvent, ...VenueHistoryEvent[]];
    if (run.length === 1) return { kind: "event", id: first.id, event: first };
    return {
      kind: "run",
      id: `run:${first.id}`,
      type: first.type,
      events: run,
      children: run.map((event) => ({ kind: "event", id: event.id, event })),
    };
  });
};
