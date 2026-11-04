"use client";

import {
  IconCpu,
  IconDatabase,
  IconDeviceDesktop,
  IconServer,
  IconStack2,
  type Icon,
} from "@tabler/icons-react";
import type { SystemStatus } from "@hagz/contracts";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { message, send } from "@/admin/errors";
import { PageHeader } from "@/admin/page-header";

const REFRESH_MS = 30_000;

type Up = SystemStatus["server"]["status"];
type Dependency = SystemStatus["database"];
interface Web {
  commit: string | null;
  startedAt: string;
}

// "3d 4h", "2h 5m", "12m", "45s": how long something has been running.
const uptime = (since: string, now: number) => {
  const seconds = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3_600);
  const m = Math.floor((seconds % 3_600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${seconds}s`;
};

const ago = (at: string, now: number) => `${uptime(at, now)} ago`;

const clock = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// Deploys carry the commit; locally there's none.
const version = (commit: string | null) => (commit ? commit.slice(0, 7) : "Local");

function Card({
  icon: Item,
  name,
  status,
  figure,
  figureLabel,
  rows,
}: {
  icon: Icon;
  name: string;
  status: Up;
  figure: string;
  figureLabel: string;
  rows: [string, string][];
}) {
  const up = status === "UP";
  return (
    <section className="rounded-hud border border-border bg-white px-5 pt-[1.125rem] pb-4">
      <header className="flex items-center gap-2">
        <Item size={18} className="size-[1.125rem] text-ink" stroke={1.75} />
        <h2 className="text-label font-semibold text-ink">{name}</h2>
        <span
          className={`ml-auto flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.75rem] font-medium ${up ? "bg-green/10 text-green" : "bg-red/10 text-red"}`}
        >
          <span className={`size-1.5 rounded-full ${up ? "bg-green" : "bg-red"}`} />
          {up ? "Operational" : "Down"}
        </span>
      </header>
      <p className="mt-[1.125rem] text-title font-semibold text-ink">{figure}</p>
      <p className="text-caption text-ink-2">{figureLabel}</p>
      <dl className="mt-3.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between border-t border-border py-[0.4375rem]">
            <dt className="text-caption text-ink-2">{label}</dt>
            <dd className="text-caption font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// Home: every part of the platform and whether it's running, refreshed every 30 seconds.
export default function AdminHome() {
  const [status, setStatus] = useState<SystemStatus>();
  const [web, setWeb] = useState<Web>();
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const [result, webResult] = await Promise.all([
      send(api.GET("/v1/admin/status")),
      fetch("/admin/web-status")
        .then((res) => res.json() as Promise<Web>)
        .catch(() => undefined),
    ]);
    if (result.ok) {
      setStatus(result.data);
      setError(undefined);
    } else setError(message(result.error));
    setWeb(webResult);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    void load();
    const refresh = setInterval(() => void load(), REFRESH_MS);
    // Uptimes and "ago" times tick between refreshes.
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [load]);

  const dependency = (dep: Dependency, engine: string): [string, string][] => [
    ["Engine", engine],
    ["Checked", status ? ago(status.checkedAt, now) : "—"],
  ];

  return (
    <>
      <PageHeader title="Home" subtitle="How every part of the platform is running right now." />
      <div className="mt-6 flex items-center gap-2">
        <span className="flex items-center gap-1 rounded-full border border-border px-3 py-[0.4375rem] text-caption">
          <span className="text-ink-2">Refreshes</span>
          <span className="font-semibold text-ink">every 30 s</span>
        </span>
        {status ? (
          <span className="flex items-center gap-1 rounded-full border border-border px-3 py-[0.4375rem] text-caption">
            <span className="text-ink-2">Checked</span>
            <span className="font-semibold text-ink">{ago(status.checkedAt, now)}</span>
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="mt-6 rounded-field bg-red/10 px-4 py-3 text-label text-red">{error}</p>
      ) : null}
      {status ? (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card
            icon={IconServer}
            name="Server"
            status={status.server.status}
            figure={status.server.startedAt ? uptime(status.server.startedAt, now) : "—"}
            figureLabel="Uptime"
            rows={[
              ["Version", version(status.server.commit)],
              [
                "Started",
                status.server.startedAt ? clock.format(new Date(status.server.startedAt)) : "—",
              ],
            ]}
          />
          <Card
            icon={IconCpu}
            name="Worker"
            status={status.worker.status}
            figure={status.worker.startedAt ? uptime(status.worker.startedAt, now) : "—"}
            figureLabel={status.worker.status === "UP" ? "Uptime" : "No heartbeat"}
            rows={[
              ["Version", status.worker.status === "UP" ? version(status.worker.commit) : "—"],
              [
                "Last heartbeat",
                status.worker.lastSeenAt ? ago(status.worker.lastSeenAt, now) : "None",
              ],
            ]}
          />
          <Card
            icon={IconDeviceDesktop}
            name="Web"
            status={web ? "UP" : "DOWN"}
            figure={web ? uptime(web.startedAt, now) : "—"}
            figureLabel="Uptime"
            rows={[
              ["Version", web ? version(web.commit) : "—"],
              ["Started", web ? clock.format(new Date(web.startedAt)) : "—"],
            ]}
          />
          {(
            [
              [IconDatabase, "Database", status.database, "Postgres"],
              [IconStack2, "Queue", status.queue, "Redis · jobs"],
              [IconStack2, "Cache", status.cache, "Redis · cache"],
            ] as const
          ).map(([item, name, dep, engine]) => (
            <Card
              key={name}
              icon={item}
              name={name}
              status={dep.status}
              figure={dep.latencyMs === null ? "—" : `${dep.latencyMs} ms`}
              figureLabel={dep.status === "UP" ? "Response time" : "Not answering"}
              rows={dependency(dep, engine)}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
