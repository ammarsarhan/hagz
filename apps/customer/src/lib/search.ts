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

export type GroundSize = components["schemas"]["GroundSize"];
export type Surface = components["schemas"]["GroundSurface"];
export type Setting = components["schemas"]["GroundEnvironment"];
export type Payment = components["schemas"]["PaymentFilter"];
export type Spread = components["schemas"]["VenueSpread"];
export type Governorate = components["schemas"]["VenueCoverage"]["data"][number];
export type Amenity = components["schemas"]["Amenity"];

// The search as the API takes it (GET /v1/venues): where, when, the filters, the order.
export interface SearchParams extends FilterQuery {
  latitude?: number;
  longitude?: number;
  radius?: number;
  area?: string;
  date?: string;
  start?: string;
  hours?: number;
  sport?: Sport;
  sort?: SearchSort;
  limit?: number;
}

// Where the player is looking: near them (within a radius), or in an area and everything under it
// (a governorate at the widest: never the whole country, user 2026-11-20).
export type Where =
  | { kind: "near"; radius: number }
  | { kind: "area"; id: string; name: string; within: string | null };

export const DEFAULT_RADIUS = 10;
export const MAX_RADIUS = 50;

// The Filters sheet's choices (Figma "C3 · Tabs & Search" A1, 127:2): the ground, the price per
// hour (minor units), the venue, how booking works. Size sits in the chips row, beside the sport.
export interface Filters {
  size?: GroundSize;
  surfaces: Surface[];
  settings: Setting[];
  grounds?: number;
  priceMin?: number;
  priceMax?: number;
  amenities: string[];
  rating?: number;
  instant: boolean;
  flexible: boolean;
  loyalty: boolean;
  payment?: Payment;
}

export const NO_FILTERS: Filters = {
  surfaces: [],
  settings: [],
  amenities: [],
  instant: false,
  flexible: false,
  loyalty: false,
};

interface FilterQuery {
  size?: GroundSize;
  surface?: string;
  setting?: string;
  grounds?: number;
  priceMin?: number;
  priceMax?: number;
  amenities?: string;
  rating?: number;
  instant?: "true";
  flexible?: "true";
  loyalty?: "true";
  payment?: Payment;
}

// The filters as query parameters, leaving out what isn't set.
export const filterQuery = (filters: Filters): FilterQuery => ({
  ...(filters.size ? { size: filters.size } : {}),
  ...(filters.surfaces.length > 0 ? { surface: filters.surfaces.join(",") } : {}),
  ...(filters.settings.length > 0 ? { setting: filters.settings.join(",") } : {}),
  ...(filters.grounds ? { grounds: filters.grounds } : {}),
  ...(filters.priceMin !== undefined ? { priceMin: filters.priceMin } : {}),
  ...(filters.priceMax !== undefined ? { priceMax: filters.priceMax } : {}),
  ...(filters.amenities.length > 0 ? { amenities: filters.amenities.join(",") } : {}),
  ...(filters.rating ? { rating: filters.rating } : {}),
  ...(filters.instant ? { instant: "true" as const } : {}),
  ...(filters.flexible ? { flexible: "true" as const } : {}),
  ...(filters.loyalty ? { loyalty: "true" as const } : {}),
  ...(filters.payment ? { payment: filters.payment } : {}),
});

export const SIZE_NAMES: Record<GroundSize, string> = {
  FIVE_A_SIDE: "5-a-side",
  SEVEN_A_SIDE: "7-a-side",
  ELEVEN_A_SIDE: "11-a-side",
  STANDARD: "Standard",
};
export const SURFACE_NAMES: Record<Surface, string> = {
  ARTIFICIAL_TURF: "Artificial turf",
  NATURAL_GRASS: "Natural grass",
  HARD_COURT: "Hard court",
  HARD_WOOD: "Hardwood",
  CLAY: "Clay",
  SAND: "Sand",
  OTHER: "Other",
};
export const SETTING_NAMES: Record<Setting, string> = {
  INDOOR: "Indoor",
  OUTDOOR: "Outdoor",
  COVERED: "Covered",
};

// "250 EGP", from minor units.
export const priceText = (minor: number, currency: string) =>
  `${Math.round(minor / 100)} ${currency}`;

// The filters on, as chips for the chips row (each with what taking it off leaves): the Filters
// button counts them. Size isn't one: it has its own chips.
export const appliedFilters = (
  filters: Filters,
  currency: string,
  amenityNames: Map<string, string>,
): { key: string; label: string; without: Filters }[] => {
  const chips: { key: string; label: string; without: Filters }[] = [];
  const add = (key: string, label: string, without: Partial<Filters>) =>
    chips.push({ key, label, without: { ...filters, ...without } });
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    const label =
      filters.priceMin !== undefined && filters.priceMax !== undefined
        ? `${Math.round(filters.priceMin / 100)}–${priceText(filters.priceMax, currency)}`
        : filters.priceMax !== undefined
          ? `Under ${priceText(filters.priceMax, currency)}`
          : `From ${priceText(filters.priceMin ?? 0, currency)}`;
    add("price", label, { priceMin: undefined, priceMax: undefined });
  }
  for (const surface of filters.surfaces) {
    add(`surface-${surface}`, SURFACE_NAMES[surface], {
      surfaces: filters.surfaces.filter((each) => each !== surface),
    });
  }
  for (const setting of filters.settings) {
    add(`setting-${setting}`, SETTING_NAMES[setting], {
      settings: filters.settings.filter((each) => each !== setting),
    });
  }
  if (filters.grounds) add("grounds", `${filters.grounds}+ grounds`, { grounds: undefined });
  for (const amenity of filters.amenities) {
    add(`amenity-${amenity}`, amenityNames.get(amenity) ?? "Amenity", {
      amenities: filters.amenities.filter((each) => each !== amenity),
    });
  }
  if (filters.rating) add("rating", `${filters.rating.toFixed(1)}+`, { rating: undefined });
  if (filters.instant) add("instant", "Instant", { instant: false });
  if (filters.flexible) add("flexible", "Free cancellation", { flexible: false });
  if (filters.payment) {
    add("payment", filters.payment === "CASH" ? "Pay cash" : "Pay online", {
      payment: undefined,
    });
  }
  if (filters.loyalty) add("loyalty", "Loyalty", { loyalty: false });
  return chips;
};

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

// How many venues are free to start each hour of a day (GET /v1/venues/free-hours), for the When
// sheet's timeline; null while loading.
export const useFreeHours = (params: SearchParams, enabled: boolean) => {
  const [counts, setCounts] = useState<number[] | null>(null);
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setCounts(null);
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { start, hours, sort, limit, ...rest } = JSON.parse(key) as SearchParams;
      const result = await send(
        api.GET("/v1/venues/free-hours", {
          params: { query: { marketplace: MARKETPLACE, ...rest } },
        }),
      );
      if (active && result.ok) setCounts(result.data.hours.map((hour) => hour.venues));
    })();
    return () => {
      active = false;
    };
  }, [key, enabled]);
  return counts;
};

// How the search's venues spread over price and distance (GET /v1/venues/spread): the Filters
// sheet's price chart and Where's radius bars. Kept while the next loads, so bars move rather
// than blink.
export const useSpread = (params: SearchParams | null) => {
  const [spread, setSpread] = useState<Spread | null>(null);
  const key = params ? JSON.stringify(params) : null;
  useEffect(() => {
    if (key === null) return;
    let active = true;
    const timer = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { sort, limit, ...rest } = JSON.parse(key) as SearchParams;
      void send(
        api.GET("/v1/venues/spread", { params: { query: { marketplace: MARKETPLACE, ...rest } } }),
      ).then((result) => {
        if (active && result.ok) setSpread(result.data);
      });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key]);
  return spread;
};

// Governorates with live venues and their areas (GET /v1/venues/coverage), read once a session.
let coverageCache: Governorate[] | null = null;
export const useCoverage = () => {
  const [coverage, setCoverage] = useState<Governorate[] | null>(coverageCache);
  useEffect(() => {
    if (coverageCache) return;
    let active = true;
    void send(
      api.GET("/v1/venues/coverage", { params: { query: { marketplace: MARKETPLACE } } }),
    ).then((result) => {
      if (!result.ok) return;
      coverageCache = result.data.data;
      if (active) setCoverage(coverageCache);
    });
    return () => {
      active = false;
    };
  }, []);
  return coverage;
};

// The marketplace's amenities, for the Filters sheet's pills and the chips' names; read once.
let amenitiesCache: Amenity[] | null = null;
export const useAmenities = () => {
  const [amenities, setAmenities] = useState<Amenity[]>(amenitiesCache ?? []);
  useEffect(() => {
    if (amenitiesCache) return;
    let active = true;
    void send(
      api.GET("/v1/marketplaces/{code}/amenities", { params: { path: { code: MARKETPLACE } } }),
    ).then((result) => {
      if (!result.ok) return;
      amenitiesCache = result.data.data;
      if (active) setAmenities(amenitiesCache);
    });
    return () => {
      active = false;
    };
  }, []);
  return amenities;
};
