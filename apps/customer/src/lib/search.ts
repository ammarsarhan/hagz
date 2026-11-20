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
  sport?: Sport;
  sort?: SearchSort;
}

interface State {
  cards: VenueCard[];
  total: number | null;
  currency: string;
  timezone: string;
  cursor: string | null;
  loading: boolean;
  error: string | null;
}

const EMPTY: State = {
  cards: [],
  total: null,
  currency: "EGP",
  timezone: "Africa/Cairo",
  cursor: null,
  loading: true,
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
      setState((previous) => ({ ...(reset ? EMPTY : previous), loading: true, error: null }));
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
        setState((previous) => ({ ...previous, loading: false, error: hudMessage(result.error) }));
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

// "Football", "Football and padel".
export const sportsText = (sports: Sport[]) => {
  const names = sports.map((sport, index) =>
    index === 0 ? SPORT_NAMES[sport] : SPORT_NAMES[sport].toLowerCase(),
  );
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
    : (names[0] ?? "");
};

// "2 grounds", or "2 courts" at a venue that's only courts (padel, tennis…).
export const groundsText = (count: number, sports: Sport[]) => {
  const courts = sports.length > 0 && !sports.includes("FOOTBALL");
  const noun = courts ? "court" : "ground";
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
};
