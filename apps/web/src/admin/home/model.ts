"use client";

import type { SystemSample, SystemStatus } from "@hagz/contracts";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { message, send } from "@/admin/errors";

// Home's data, with no design: the platform's status now (refreshed every 30 seconds) and its last
// 24 hours a minute at a time (refreshed every minute), and what the page works out from them for
// the range picked. Nothing here asks the API for more than it already gave.

const REFRESH_MS = 30_000;
// The history gains a sample a minute; asking more often than that finds nothing new.
const HISTORY_MS = 60_000;
export const MINUTE = 60_000;

export type Up = SystemStatus["server"]["status"];
export interface Web {
  commit: string | null;
  startedAt: string;
}

export const RANGES = [
  { id: "1h", label: "Last hour", ms: 60 * MINUTE, short: "1 h" },
  { id: "6h", label: "Last 6 hours", ms: 6 * 60 * MINUTE, short: "6 h" },
  { id: "24h", label: "Last 24 hours", ms: 24 * 60 * MINUTE, short: "24 h" },
] as const;
export type RangeId = (typeof RANGES)[number]["id"];

export function useSystem() {
  const [status, setStatus] = useState<SystemStatus>();
  const [web, setWeb] = useState<Web | null>();
  const [samples, setSamples] = useState<SystemSample[]>([]);
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [result, webResult] = await Promise.all([
      send(api.GET("/v1/admin/status")),
      fetch("/admin/web-status")
        .then((res) => res.json() as Promise<Web>)
        .catch(() => null),
    ]);
    if (result.ok) {
      setStatus(result.data);
      setError(undefined);
    } else setError(message(result.error));
    setWeb(webResult);
    setNow(Date.now());
  }, []);

  const loadHistory = useCallback(async () => {
    const result = await send(api.GET("/v1/admin/status/history"));
    if (result.ok) setSamples(result.data.samples);
  }, []);

  useEffect(() => {
    void load();
    void loadHistory();
    const refresh = setInterval(() => void load(), REFRESH_MS);
    const history = setInterval(() => void loadHistory(), HISTORY_MS);
    // Uptimes and "ago" times tick between refreshes.
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      clearInterval(refresh);
      clearInterval(history);
      clearInterval(tick);
    };
  }, [load, loadHistory]);

  // The refresh button: both at once, with the button busy until they're back.
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), loadHistory()]);
    setRefreshing(false);
  };

  return { status, web, samples, error, now, refreshing, refresh };
}

// --- Formatting ---

// "3d 4h", "2h 5m", "12m", "45s": how long something has been running.
export const duration = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3_600);
  const m = Math.floor((seconds % 3_600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${seconds}s`;
};
export const uptime = (since: string, now: number) => duration(now - new Date(since).getTime());
export const ago = (at: string, now: number) =>
  now - new Date(at).getTime() < 5_000 ? "just now" : `${uptime(at, now)} ago`;
export const clock = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
// Deploys carry the commit; locally there's none.
export const version = (commit: string | null) => (commit ? commit.slice(0, 7) : "Local");
export const percent = (share: number) => `${share >= 0.9995 ? "100" : (share * 100).toFixed(1)}%`;

// --- What the range shows ---

// The parts with a minute-by-minute history. The server's is implied: a sample exists only when a
// server took it, so a minute without one is a minute the server was down.
export const TRACKED = [
  { key: "server", label: "Server" },
  { key: "worker", label: "Worker" },
  { key: "database", label: "Postgres" },
  { key: "queue", label: "Jobs" },
  { key: "cache", label: "Cache" },
] as const;
export type Tracked = (typeof TRACKED)[number]["key"];

export const DEPENDENCIES = [
  {
    key: "database",
    label: "Postgres",
  },
  {
    key: "queue",
    label: "Jobs",
  },
  {
    key: "cache",
    label: "Cache",
  },
] as const;
export type Dependency = (typeof DEPENDENCIES)[number]["key"];

const upIn = (sample: SystemSample, key: Tracked) =>
  key === "server" ? true : key === "worker" ? sample.worker === "UP" : sample[key].status === "UP";

// The minutes of [from, now) the history can speak for: from the range's start or the first sample,
// whichever is later, to the last whole minute (the current one has no sample yet).
const minutesOf = (samples: SystemSample[], from: number, now: number) => {
  const first = samples[0] ? new Date(samples[0].at).getTime() : undefined;
  if (first === undefined) return [];
  const start = Math.ceil(Math.max(from, first) / MINUTE) * MINUTE;
  const end = Math.floor(now / MINUTE) * MINUTE;
  const minutes: number[] = [];
  for (let at = start; at < end; at += MINUTE) minutes.push(at);
  return minutes;
};

export function rangeView(samples: SystemSample[], from: number, now: number) {
  const byMinute = new Map(
    samples.map((sample) => [Math.floor(new Date(sample.at).getTime() / MINUTE) * MINUTE, sample]),
  );
  const minutes = minutesOf(samples, from, now);
  const inRange = samples.filter((sample) => new Date(sample.at).getTime() >= from);

  // Share of minutes each part was up. A minute without a sample counts as down for every part:
  // nothing was running to say otherwise.
  const availability = TRACKED.map(({ key, label }) => {
    const up = minutes.filter((at) => {
      const sample = byMinute.get(at);
      return sample ? upIn(sample, key) : false;
    }).length;
    return { key, label, up, share: minutes.length ? up / minutes.length : null };
  });

  // Every minute that was down for anything, for the overview's bars.
  const downMinutes = minutes.filter((at) => {
    const sample = byMinute.get(at);
    return !sample || TRACKED.some(({ key }) => !upIn(sample, key));
  });

  // Unbroken stretches each part was down, newest first. Without a sample only the server is known
  // to be down; the others weren't measured.
  const stretches: { key: Tracked; label: string; from: number; minutes: number }[] = [];
  for (const { key, label } of TRACKED) {
    let start: number | undefined;
    const close = (end: number) => {
      if (start === undefined) return;
      stretches.push({ key, label, from: start, minutes: Math.round((end - start) / MINUTE) });
      start = undefined;
    };
    for (const at of minutes) {
      const sample = byMinute.get(at);
      const down = key === "server" ? !sample : sample ? !upIn(sample, key) : false;
      if (down && start === undefined) start = at;
      if (!down) close(at);
    }
    close((minutes.at(-1) ?? 0) + MINUTE);
  }
  stretches.sort((a, b) => b.from - a.from);

  // The median, slow (95th percentile) and slowest response of each dependency.
  const latencies = DEPENDENCIES.map(({ key, label }) => {
    const values = inRange.flatMap((sample) => sample[key].latencyMs ?? []).sort((a, b) => a - b);
    const at = (q: number) => values[Math.max(0, Math.ceil(q * values.length) - 1)] ?? null;
    return { key, label, p50: at(0.5), p95: at(0.95), max: values.at(-1) ?? null };
  });

  const points = (key: Dependency) =>
    inRange.map((sample) => ({ at: new Date(sample.at).getTime(), value: sample[key].latencyMs }));

  const strip = (key: Tracked) =>
    key === "server"
      ? // Only minutes with a sample are drawn; a grey block is one with none.
        inRange.map((sample) => ({ at: new Date(sample.at).getTime(), up: true }))
      : inRange.map((sample) => ({ at: new Date(sample.at).getTime(), up: upIn(sample, key) }));

  return {
    availability,
    downMinutes,
    stretches,
    latencies,
    points,
    strip,
    hasHistory: minutes.length > 0,
  };
}
