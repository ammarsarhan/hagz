import type { components } from "@hagz/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, auth } from "./api";
import { send } from "./api-errors";
import { MARKETPLACE, type Governorate, type SearchParams, type VenueCard } from "./search";

// Home's data (Figma C12, 311:2 signed in, 312:2 guest): where the rails look, the player's next
// game, and each rail's venues or games. Rails are read once when Home opens and on pull to
// refresh; the next game each time Home is shown (a booking just made, a code just used).

type Booking = components["schemas"]["BookingSummary"];
type Game = components["schemas"]["Game"];
export type PlayedVenue = components["schemas"]["PlayAgainVenue"];
export type SavedVenue = components["schemas"]["FavoriteVenue"];

export const DEFAULT_RADIUS_KM = 10;
// Free tonight starts here, or later once it's later.
export const TONIGHT_FROM = "19:00";
// Within budget: under this an hour, in minor units.
export const BUDGET = 25_000;
const RAIL = 10;

export interface Rail<T> {
  items: T[];
  // The day searched (Free tonight moves to tomorrow once tonight's over); null for games.
  date: string | null;
  loading: boolean;
  // The last read's failure (`send`'s error), null once one works: Home shows Unplugged when
  // every rail failed.
  error: unknown;
}

const EMPTY = { items: [], date: null, loading: true, error: null };

// A rail of venues: the search with Home's where and the rail's own choices.
export const useVenueRail = (
  params: SearchParams,
  ready: boolean,
  generation: number,
): Rail<VenueCard> & { currency: string; timezone: string } => {
  const [rail, setRail] = useState<Rail<VenueCard> & { currency: string; timezone: string }>({
    ...EMPTY,
    currency: "EGP",
    timezone: "Africa/Cairo",
  });
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    void send(
      api.GET("/v1/venues", {
        params: {
          query: {
            marketplace: MARKETPLACE,
            limit: RAIL,
            ...(JSON.parse(key) as SearchParams),
          },
        },
      }),
    ).then((result) => {
      if (!active) return;
      setRail((now) =>
        result.ok
          ? {
              items: result.data.data,
              date: result.data.date,
              loading: false,
              error: null,
              currency: result.data.currency,
              timezone: result.data.timezone,
            }
          : { ...now, loading: false, error: result.error },
      );
    });
    return () => {
      active = false;
    };
  }, [key, ready, generation]);
  return rail;
};

// Games needing players, near where Home looks.
export const useGameRail = (params: SearchParams, ready: boolean, generation: number) => {
  const [rail, setRail] = useState<Rail<Game>>(EMPTY);
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const where = JSON.parse(key) as SearchParams;
    void send(
      api.GET("/v1/games", {
        params: {
          query: {
            limit: RAIL,
            ...(where.area ? { area: where.area } : {}),
            ...(where.latitude !== undefined && where.longitude !== undefined
              ? {
                  latitude: where.latitude,
                  longitude: where.longitude,
                  radius: where.radius ?? DEFAULT_RADIUS_KM,
                }
              : {}),
          },
        },
      }),
    ).then((result) => {
      if (!active) return;
      setRail((now) =>
        result.ok
          ? { items: result.data.data, date: null, loading: false, error: null }
          : { ...now, loading: false, error: result.error },
      );
    });
    return () => {
      active = false;
    };
  }, [key, ready, generation]);
  return rail;
};

export type NextGame = { kind: "booking"; booking: Booking } | { kind: "game"; game: Game };

// The player's own part of Home, read each time Home is shown: their first name, their next game
// (the soonest confirmed booking or joined game still to come), the venues they've played at, and
// the venues they saved (those still taking bookings). `next` is undefined while reading; null
// for a guest or nothing coming up.
export const useNextGame = () => {
  const [next, setNext] = useState<NextGame | null | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);
  const [played, setPlayed] = useState<PlayedVenue[]>([]);
  const [saved, setSaved] = useState<SavedVenue[]>([]);
  const request = useRef(0);
  const read = useCallback(async () => {
    const mine = ++request.current;
    if (!(await auth.isSignedIn())) {
      if (mine === request.current) {
        setNext(null);
        setName(null);
        setPlayed([]);
        setSaved([]);
      }
      return;
    }
    const [bookings, games, me, again, favorites] = await Promise.all([
      send(api.GET("/v1/bookings", { params: { query: { when: "upcoming", limit: 5 } } })),
      send(api.GET("/v1/games/mine", { params: { query: { when: "upcoming", limit: 5 } } })),
      send(api.GET("/v1/customers/me")),
      send(api.GET("/v1/bookings/again")),
      send(api.GET("/v1/customers/me/favorites")),
    ]);
    if (mine !== request.current) return;
    if (me.ok) setName(me.data.name.trim().split(/\s+/)[0] ?? null);
    if (again.ok) setPlayed(again.data.data);
    if (favorites.ok) setSaved(favorites.data.data.filter((venue) => venue.status === "LIVE"));
    const now = Date.now();
    const candidates: NextGame[] = [
      ...(bookings.ok
        ? bookings.data.data
            .filter((b) => b.status === "CONFIRMED" && Date.parse(b.endsAt) > now)
            .map((booking) => ({ kind: "booking" as const, booking }))
        : []),
      ...(games.ok
        ? games.data.data
            .filter((g) => g.status !== "CANCELLED" && Date.parse(g.endsAt) > now)
            .map((game) => ({ kind: "game" as const, game }))
        : []),
    ];
    const startOf = (entry: NextGame) =>
      Date.parse(entry.kind === "booking" ? entry.booking.startsAt : entry.game.startsAt);
    candidates.sort((a, b) => startOf(a) - startOf(b));
    setNext(candidates[0] ?? null);
  }, []);
  return { next, name, played, saved, read };
};

// The next date (YYYY-MM-DD, on the venue's clock) for a usual day and time: today if that time is
// still to come, else the next such weekday. Home's Book on a Play again card opens it.
export const nextDateFor = (usual: { weekday: number; start: string }, timezone: string) => {
  const nowTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  for (let days = 0; days <= 7; days++) {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
      new Date(Date.now() + days * 86_400_000),
    );
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (weekday === usual.weekday && (days > 0 || usual.start > nowTime)) return date;
  }
  return null;
};

// Home's feed is one governorate (user, 2026-11-23): narrowing it further is Search's job. The one
// the phone is in (the nearest area's governorate); without a position, or where Hagz has no venues
// yet, the one with the most venues (coverage comes most venues first). Picking another is for
// later (user, 2026-11-24): the picker sheet was taken out until then.
export const useHomeGovernorate = (
  here: { latitude: number; longitude: number } | null | undefined,
  coverage: Governorate[] | null,
) => {
  const [nearestArea, setNearestArea] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (here === undefined) return;
    if (here === null) {
      setNearestArea(null);
      return;
    }
    let active = true;
    void send(
      api.GET("/v1/marketplaces/{code}/areas/nearest", {
        params: {
          path: { code: MARKETPLACE },
          query: { latitude: here.latitude, longitude: here.longitude },
        },
      }),
    ).then((result) => {
      if (active) setNearestArea(result.ok ? (result.data.area?.id ?? null) : null);
    });
    return () => {
      active = false;
    };
  }, [here]);

  // The phone's governorate among those with venues: the nearest area is one of its areas, or it.
  const mine =
    nearestArea && coverage
      ? (coverage.find(
          (governorate) =>
            governorate.id === nearestArea ||
            governorate.areas.some((area) => area.id === nearestArea),
        ) ?? null)
      : null;
  const settled = here !== undefined && (here === null || nearestArea !== undefined);
  return settled ? (mine ?? coverage?.[0] ?? null) : null;
};
