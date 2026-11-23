import type { components } from "@hagz/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, auth } from "./api";
import { send } from "./api-errors";
import { MARKETPLACE, type SearchParams, type VenueCard, type Where } from "./search";

// Home's data (Figma C12, 311:2 signed in, 312:2 guest): where the rails look, the player's next
// game, and each rail's venues or games. Rails are read once when Home opens and on pull to
// refresh; the next game each time Home is shown (a booking just made, a code just used).

type Booking = components["schemas"]["BookingSummary"];
type Game = components["schemas"]["Game"];

export const DEFAULT_RADIUS_KM = 10;
// Free tonight starts here, or later once it's later.
export const TONIGHT_FROM = "19:00";
// Within budget: under this an hour, in minor units.
export const BUDGET = 25_000;
const RAIL = 10;

// Where Home's rails look, as the search's own query: around the player, or in an area.
export const whereQuery = (
  where: Where | null,
  here: { latitude: number; longitude: number } | null,
): SearchParams =>
  where?.kind === "area"
    ? { area: where.id }
    : where?.kind === "around"
      ? { latitude: where.latitude, longitude: where.longitude, radius: where.radius }
      : here && where
        ? { latitude: here.latitude, longitude: here.longitude, radius: where.radius }
        : {};

// The name for where (the header, and "Near Maadi"): the area the phone is in, or the one picked.
export const useAreaName = (
  where: Where | null,
  here: { latitude: number; longitude: number } | null | undefined,
) => {
  const [near, setNear] = useState<{ name: string; within: string | null } | null>(null);
  useEffect(() => {
    if (where?.kind !== "near" || !here) return;
    let active = true;
    void send(
      api.GET("/v1/marketplaces/{code}/areas/nearest", {
        params: {
          path: { code: MARKETPLACE },
          query: { latitude: here.latitude, longitude: here.longitude },
        },
      }),
    ).then((result) => {
      if (active && result.ok && result.data.area)
        setNear({ name: result.data.area.name, within: result.data.area.within });
    });
    return () => {
      active = false;
    };
  }, [where?.kind, here]);
  if (where?.kind === "area") return { name: where.name, within: where.within };
  if (where?.kind === "around") return { name: where.name, within: null };
  return near;
};

export interface Rail<T> {
  items: T[];
  // The day searched (Free tonight moves to tomorrow once tonight's over); null for games.
  date: string | null;
  loading: boolean;
}

const EMPTY = { items: [], date: null, loading: true };

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
              currency: result.data.currency,
              timezone: result.data.timezone,
            }
          : { ...now, loading: false },
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
          ? { items: result.data.data, date: null, loading: false }
          : { ...now, loading: false },
      );
    });
    return () => {
      active = false;
    };
  }, [key, ready, generation]);
  return rail;
};

export type NextGame = { kind: "booking"; booking: Booking } | { kind: "game"; game: Game };

// The player's next game: their soonest confirmed booking or joined game still to come. Undefined
// while reading; null for a guest or nothing coming up.
export const useNextGame = () => {
  const [next, setNext] = useState<NextGame | null | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);
  const request = useRef(0);
  const read = useCallback(async () => {
    const mine = ++request.current;
    if (!(await auth.isSignedIn())) {
      if (mine === request.current) {
        setNext(null);
        setName(null);
      }
      return;
    }
    const [bookings, games, me] = await Promise.all([
      send(api.GET("/v1/bookings", { params: { query: { when: "upcoming", limit: 5 } } })),
      send(api.GET("/v1/games/mine", { params: { query: { when: "upcoming", limit: 5 } } })),
      send(api.GET("/v1/customers/me")),
    ]);
    if (mine !== request.current) return;
    if (me.ok) setName(me.data.name.trim().split(/\s+/)[0] ?? null);
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
  return { next, name, read };
};
