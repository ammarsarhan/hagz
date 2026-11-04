"use client";

import type { SystemSample, SystemStatus } from "@hagz/contracts";
import { IconInfoSquareRounded } from "@tabler/icons-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "@/admin/api";
import { AvailabilityStrip, LineChart, availability } from "@/admin/charts";
import { message, send } from "@/admin/errors";
import { PageHeader } from "@/admin/page-header";

const REFRESH_MS = 30_000;
// The history gains a sample a minute; asking more often than that finds nothing new.
const HISTORY_MS = 60_000;

type Up = SystemStatus["server"]["status"];
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
const ago = (at: string, now: number) =>
  now - new Date(at).getTime() < 5_000 ? "just now" : `${uptime(at, now)} ago`;
const clock = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
// Deploys carry the commit; locally there's none.
const version = (commit: string | null) => (commit ? commit.slice(0, 7) : "Local");

function Badge({ status }: { status: Up }) {
  const up = status === "UP";
  return (
    <span
      className={`rounded-[0.3125rem] px-1.5 py-px text-[0.75rem] font-semibold ${up ? "bg-green/10 text-green" : "bg-red/10 text-red"}`}
    >
      {up ? "Operational" : "Down"}
    </span>
  );
}

const Dot = ({ up }: { up: boolean }) => (
  <span className={`size-2.5 shrink-0 rounded-[0.1875rem] ${up ? "bg-green" : "bg-red"}`} />
);

// Stripe's widget (the user's reference): a title with an info mark and an optional badge, then
// the content, then a quiet "Updated" line. No card: widgets sit on the page in a grid.
function Widget({
  title,
  info,
  badge,
  updated,
  children,
}: {
  title: string;
  info: string;
  badge?: ReactNode;
  updated: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col">
      <header className="flex items-center gap-1.5">
        <h2 className="text-body font-semibold text-ink">{title}</h2>
        <span title={info} aria-label={info} className="text-ink-3">
          <IconInfoSquareRounded size={16} className="size-4" stroke={1.75} />
        </span>
        {badge ? <span className="ml-1">{badge}</span> : null}
      </header>
      <div className="mt-3 flex-1">{children}</div>
      <p className="mt-6 text-right text-label text-ink-3">Updated {updated}</p>
    </section>
  );
}

// Rows with a label on the left and a value on the right, hairlines between them.
function Rows({ rows }: { rows: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center justify-between border-b border-border py-2.5">
          <dt className="flex items-center gap-2.5 text-body text-ink-2">{row.label}</dt>
          <dd className="text-body font-semibold text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// A headline figure with a grey note beside it, as in Stripe's "MYR 2.00  MYR 0.00 previous period".
function Figure({ value, note }: { value: string; note: string }) {
  return (
    <p className="flex items-baseline gap-2">
      <span className="text-heading text-ink">{value}</span>
      <span className="text-label text-ink-2">{note}</span>
    </p>
  );
}

// One row of widgets: equal columns with a real gap between them, and the full-width hairline above
// the row (Stripe's separators run across the gaps, so the row draws them, not each widget).
function Row({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-12 gap-y-8 border-t border-border py-8 lg:grid-cols-3">
      {children}
    </div>
  );
}

// Home: every part of the platform and whether it's running, refreshed every 30 seconds.
export default function AdminHome() {
  const [status, setStatus] = useState<SystemStatus>();
  const [web, setWeb] = useState<Web | null>();
  const [samples, setSamples] = useState<SystemSample[]>([]);
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(() => Date.now());

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

  const header = (
    <PageHeader title="Home" subtitle="How every part of the platform is running right now." />
  );
  if (!status) {
    return (
      <>
        {header}
        {error ? (
          <p className="mt-8 rounded-field bg-red/10 px-4 py-3 text-label text-red">{error}</p>
        ) : null}
      </>
    );
  }

  const updated = ago(status.checkedAt, now);
  const webStatus: Up = web ? "UP" : "DOWN";
  const services: { name: string; status: Up }[] = [
    { name: "Server", status: status.server.status },
    { name: "Worker", status: status.worker.status },
    { name: "Web", status: webStatus },
    { name: "Database", status: status.database.status },
    { name: "Queue", status: status.queue.status },
    { name: "Cache", status: status.cache.status },
  ];
  const ms = (latency: number | null) => (latency === null ? "Not answering" : `${latency} ms`);
  const at = (sample: SystemSample) => new Date(sample.at).getTime();
  // A sample exists only when a server took it, so every sample says the server was up.
  const serverSamples = samples.map((sample) => ({ at: at(sample), up: true }));
  const workerSamples = samples.map((sample) => ({ at: at(sample), up: sample.worker === "UP" }));
  const series = (pick: (sample: SystemSample) => SystemSample["database"]) =>
    samples.map((sample) => ({ at: at(sample), value: pick(sample).latencyMs }));
  const peak = (pick: (sample: SystemSample) => SystemSample["database"]) => {
    const values = samples.flatMap((sample) => pick(sample).latencyMs ?? []);
    return values.length ? `peak ${Math.max(...values)} ms in 24 h` : "no history yet";
  };
  const latencyCharts = [
    {
      title: "Postgres",
      info: "How long a trivial query takes, measured by the server every minute.",
      now: status.database,
      pick: (sample: SystemSample) => sample.database,
    },
    {
      title: "Redis · jobs",
      info: "The Redis that holds jobs and rate limits. A PING, every minute.",
      now: status.queue,
      pick: (sample: SystemSample) => sample.queue,
    },
    {
      title: "Redis · cache",
      info: "The Redis used as a cache. A PING, every minute.",
      now: status.cache,
      pick: (sample: SystemSample) => sample.cache,
    },
  ];

  return (
    <>
      {header}
      {error ? (
        <p className="mt-8 rounded-field bg-red/10 px-4 py-3 text-label text-red">{error}</p>
      ) : null}
      <div className="mt-8">
        <Row>
          <Widget
            title="Services"
            info="Every part of the platform, green while it answers."
            updated={updated}
          >
            <div className="mt-0.5 flex h-3 gap-0.5 overflow-hidden rounded-full">
              {services.map((service) => (
                <span
                  key={service.name}
                  className={`flex-1 ${service.status === "UP" ? "bg-green" : "bg-red"}`}
                />
              ))}
            </div>
            <div className="mt-3">
              <Rows
                rows={services.map((service) => ({
                  label: (
                    <>
                      <Dot up={service.status === "UP"} />
                      {service.name}
                    </>
                  ),
                  value: service.status === "UP" ? "Operational" : "Down",
                }))}
              />
            </div>
          </Widget>
          <Widget
            title="Server"
            info="The API answering this page. A grey block is half an hour with no samples: no server was running to take one, so it counts as down."
            badge={<Badge status={status.server.status} />}
            updated={updated}
          >
            <Figure
              value={status.server.startedAt ? uptime(status.server.startedAt, now) : "—"}
              note={`${availability(serverSamples, now) ?? "—"} available in 24 h`}
            />
            <div className="mt-8">
              <AvailabilityStrip samples={serverSamples} now={now} />
            </div>
          </Widget>
          <Widget
            title="Worker"
            info="Runs background jobs. Up while its heartbeat, every 10 seconds, keeps arriving."
            badge={<Badge status={status.worker.status} />}
            updated={updated}
          >
            <Figure
              value={status.worker.startedAt ? uptime(status.worker.startedAt, now) : "—"}
              note={`${availability(workerSamples, now) ?? "—"} available in 24 h`}
            />
            <div className="mt-8">
              <AvailabilityStrip samples={workerSamples} now={now} />
            </div>
          </Widget>
        </Row>
        <Row>
          {latencyCharts.map((chart) => (
            <Widget
              key={chart.title}
              title={chart.title}
              info={chart.info}
              badge={<Badge status={chart.now.status} />}
              updated={updated}
            >
              <Figure value={ms(chart.now.latencyMs)} note={peak(chart.pick)} />
              <div className="mt-7">
                <LineChart points={series(chart.pick)} unit="ms" />
              </div>
            </Widget>
          ))}
        </Row>
        <Row>
          <Widget
            title="Web"
            info="This admin web and the public site."
            badge={<Badge status={webStatus} />}
            updated={updated}
          >
            <Figure
              value={web ? uptime(web.startedAt, now) : "—"}
              note={web ? `up since ${clock.format(new Date(web.startedAt))}` : "not answering"}
            />
          </Widget>
          <Widget
            title="Versions"
            info="The commit each process was deployed from. Local when nothing deployed it."
            updated={updated}
          >
            <Rows
              rows={[
                { label: "Server", value: version(status.server.commit) },
                {
                  label: "Worker",
                  value: status.worker.status === "UP" ? version(status.worker.commit) : "—",
                },
                { label: "Web", value: web ? version(web.commit) : "—" },
              ]}
            />
          </Widget>
        </Row>
      </div>
    </>
  );
}
