import type { components } from "@hagz/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { hudMessage, send } from "./api-errors";

// Searching venues (GET /v1/venues, PR 3.3): one page at a time, the next on reaching the end.

export type VenueCard = components["schemas"]["VenueCard"];
export type Sport = components["schemas"]["GroundSport"];
export type SearchSort = components["schemas"]["VenueSearchSort"];

// The customer app's marketplace until it lets players pick a country.
export const MARKETPLACE = "EG";

export interface SearchParams {
  latitude?: number;
  longitude?: number;
  area?: string;
  date?: string;
  start?: string;
  hours?: number;
  sport?: Sport;
  sort?: SearchSort;
  limit?: number;
}

// Where the player is looking: near them, in an area (and everything under it), or anywhere.
export type Where =
  | { kind: "near" }
  | { kind: "everywhere" }
  | { kind: "area"; id: string; name: string; within: string | null };

// When: a day (null for today), a start (HH:mm, null for any time) and how long.
export interface When {
  date: string | null;
  start: string | null;
  hours: number;
}

export const ANY_TIME: When = { date: null, start: null, hours: 1 };

// The local date in a timezone (YYYY-MM-DD), `days` from today.
export const localDate = (timezone: string, days = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
    new Date(Date.now() + days * 86_400_000),
  );

// "9 pm" for 21, "12 am" for 0.
export const hourLabel = (hour: number) =>
  `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? "am" : "pm"}`;

// "Today", "Tomorrow", "Fri 21".
export const dayText = (date: string | null, timezone: string) => {
  if (date === null || date === localDate(timezone)) return "Today";
  if (date === localDate(timezone, 1)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric" })
    .format(new Date(`${date}T12:00:00Z`))
    .replace(",", "");
};

// The search bar's second line: "Today · any time", "Fri 21 · 9–11 pm".
export const whenText = (when: When, timezone: string) => {
  const day = dayText(when.date, timezone);
  // A length only comes with a start (the start is a run of hours).
  if (!when.start) return `${day} · any time`;
  const from = Number(when.start.slice(0, 2));
  const to = (from + when.hours) % 24;
  const range =
    from < 12 === to < 12 && to !== 0
      ? `${hourLabel(from).replace(/ [ap]m$/, "")}–${hourLabel(to)}`
      : `${hourLabel(from)}–${hourLabel(to)}`;
  return `${day} · ${range}`;
};

// How many venues a search would find, for "Show 24 venues": one card asked for, the total read,
// a moment after the choices stop changing.
export const useVenueCount = (params: SearchParams, enabled: boolean) => {
  const [count, setCount] = useState<number | null>(null);
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        const result = await send(
          api.GET("/v1/venues", {
            params: {
              query: { marketplace: MARKETPLACE, ...(JSON.parse(key) as SearchParams), limit: 1 },
            },
          }),
        );
        if (active) setCount(result.ok ? result.data.total : null);
      })();
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, enabled]);
  return count;
};

interface State {
  cards: VenueCard[];
  total: number | null;
  currency: string;
  timezone: string;
  cursor: string | null;
  loading: boolean;
  // Loading the next page, rather than the search again.
  loadingMore: boolean;
  error: string | null;
}

const EMPTY: State = {
  cards: [],
  total: null,
  currency: "EGP",
  timezone: "Africa/Cairo",
  cursor: null,
  loading: true,
  loadingMore: false,
  error: null,
};

// `ready` false holds the search back (while the phone's position is still being found).
export const useVenueSearch = (params: SearchParams, ready: boolean) => {
  const [state, setState] = useState<State>(EMPTY);
  // Answers that arrive after the search changed are dropped.
  const generation = useRef(0);
  const key = JSON.stringify(params);

  const fetchPage = useCallback(
    async (cursor: string | null, reset: boolean) => {
      const mine = generation.current;
      // Searching again keeps the results on screen until the new ones arrive, so a change (a
      // sport, the order) moves the list rather than blanking it.
      setState((previous) => ({
        ...previous,
        loading: true,
        loadingMore: !reset,
        error: null,
      }));
      const result = await send(
        api.GET("/v1/venues", {
          params: {
            query: {
              marketplace: MARKETPLACE,
              ...(JSON.parse(key) as SearchParams),
              ...(cursor ? { cursor } : {}),
            },
          },
        }),
      );
      if (mine !== generation.current) return;
      if (!result.ok) {
        setState((previous) => ({
          ...previous,
          ...(reset ? { cards: [], total: null, cursor: null } : {}),
          loading: false,
          loadingMore: false,
          error: hudMessage(result.error),
        }));
        return;
      }
      const page = result.data;
      setState((previous) => ({
        cards: reset ? page.data : [...previous.cards, ...page.data],
        total: reset ? page.total : previous.total,
        currency: page.currency,
        timezone: page.timezone,
        cursor: page.nextCursor,
        loading: false,
        loadingMore: false,
        error: null,
      }));
    },
    [key],
  );

  useEffect(() => {
    if (!ready) return;
    generation.current++;
    void fetchPage(null, true);
  }, [fetchPage, ready]);

  return {
    ...state,
    refresh: () => {
      generation.current++;
      void fetchPage(null, true);
    },
    loadMore: () => {
      if (state.cursor && !state.loading) void fetchPage(state.cursor, false);
    },
  };
};

const SPORT_NAMES: Record<Sport, string> = {
  FOOTBALL: "Football",
  PADEL: "Padel",
  TENNIS: "Tennis",
  BASKETBALL: "Basketball",
  VOLLEYBALL: "Volleyball",
};

export const sportName = (sport: Sport) => SPORT_NAMES[sport];

// "Football", "Football/Padel" (user, 2026-11-20).
export const sportsText = (sports: Sport[]) => sports.map((sport) => SPORT_NAMES[sport]).join("/");

// "2 grounds", or "2 courts" at a venue that's only courts (padel, tennis…).
export const groundsText = (count: number, sports: Sport[]) => {
  const courts = sports.length > 0 && !sports.includes("FOOTBALL");
  const noun = courts ? "court" : "ground";
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
};
