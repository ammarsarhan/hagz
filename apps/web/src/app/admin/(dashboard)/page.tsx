"use client";

import { IconCalendar, IconRefresh } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/admin/button";
import { AvailabilityStrip, Legend, LineChart, OverviewChart, type Series } from "@/admin/charts";
import { Skeleton } from "@/admin/data-table";
import { Dot, Section, ShareTable, Stat } from "@/admin/home/blocks";
import {
  DEPENDENCIES,
  RANGES,
  TRACKED,
  ago,
  clock,
  duration,
  percent,
  rangeView,
  uptime,
  version,
  useSystem,
  type RangeId,
  type Up,
} from "@/admin/home/model";
import { PageHeader } from "@/admin/page-header";
import { PillSelect } from "@/admin/pill-select";

// Home, laid out after Gumloop's Insights (the user's reference of 2026-11-11) on the data it
// already had: the title with a range and a refresh on the right, a row of big figures, one chart of
// every response time with downtime behind it, then sections of tables and charts two to a row.

// The overview's series, darkest first; the admin web is neutral ink, so shade tells them apart.
const SHADES: Record<string, { line: string; dot: string; dashed?: boolean }> = {
  database: { line: "text-ink", dot: "bg-ink" },
  queue: { line: "text-ink-2", dot: "bg-ink-2" },
  cache: { line: "text-ink-3", dot: "bg-ink-3", dashed: true },
};

const ms = (latency: number | null) => (latency === null ? "—" : `${latency} ms`);

export default function AdminHome() {
  const { status, web, samples, error, now, refreshing, refresh } = useSystem();
  const [rangeId, setRangeId] = useState<RangeId>("24h");
  const range = RANGES.find((r) => r.id === rangeId)!;
  const from = now - range.ms;

  const header = (
    <PageHeader
      title="Home"
      subtitle={
        status
          ? `How every part of the platform is running. Updated ${ago(status.checkedAt, now)}.`
          : "How every part of the platform is running."
      }
      actions={
        <>
          <PillSelect
            label="Range"
            icon={IconCalendar}
            value={rangeId}
            onChange={(event) => setRangeId(event.target.value as RangeId)}
            options={RANGES.map((r) => ({ value: r.id, label: r.label }))}
          />
          {/* The icon spins while it loads, rather than the button's own spinner: that one is
              bigger than the icon and would grow the button for a moment. */}
          <Button
            size="small"
            variant="secondary"
            aria-label="Refresh"
            title="Refresh"
            aria-busy={refreshing}
            onClick={() => void refresh()}
          >
            <IconRefresh
              size={16}
              className={`size-4 ${refreshing ? "animate-spin" : ""}`}
              stroke={2}
            />
          </Button>
        </>
      }
    />
  );

  if (!status) {
    return (
      <>
        {header}
        {error ? (
          <p className="mt-8 rounded-field bg-red/10 px-4 py-3 text-label text-red">{error}</p>
        ) : (
          <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-6">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i}>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-3 h-7 w-20" />
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  const view = rangeView(samples, from, now);
  const webStatus: Up = web ? "UP" : "DOWN";
  const services: { name: string; status: Up; detail: string }[] = [
    {
      name: "Server",
      status: status.server.status,
      detail: status.server.startedAt ? `up ${uptime(status.server.startedAt, now)}` : "—",
    },
    {
      name: "Worker",
      status: status.worker.status,
      detail: status.worker.startedAt ? `up ${uptime(status.worker.startedAt, now)}` : "—",
    },
    { name: "Web", status: webStatus, detail: web ? `up ${uptime(web.startedAt, now)}` : "—" },
    { name: "Postgres", status: status.database.status, detail: ms(status.database.latencyMs) },
    { name: "Jobs", status: status.queue.status, detail: ms(status.queue.latencyMs) },
    { name: "Cache", status: status.cache.status, detail: ms(status.cache.latencyMs) },
  ];
  const upCount = services.filter((s) => s.status === "UP").length;
  const serverShare = view.availability.find((a) => a.key === "server")?.share ?? null;

  const series: Series[] = DEPENDENCIES.map(({ key, label }) => ({
    key,
    label,
    points: view.points(key),
    shade: SHADES[key]!.line,
    dashed: SHADES[key]!.dashed,
  }));

  return (
    <>
      {header}
      {error ? (
        <p className="mt-8 rounded-field bg-red/10 px-4 py-3 text-label text-red">{error}</p>
      ) : null}

      <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-6">
        <Stat
          label="Services up"
          value={`${upCount}/${services.length}`}
          bad={upCount < services.length}
        />
        <Stat
          label={`Availability · ${range.short}`}
          value={serverShare === null ? "—" : percent(serverShare)}
          bad={serverShare !== null && serverShare < 0.99}
        />
        <Stat
          label="Server uptime"
          value={status.server.startedAt ? uptime(status.server.startedAt, now) : "—"}
        />
        <Stat
          label="Worker uptime"
          value={status.worker.startedAt ? uptime(status.worker.startedAt, now) : "—"}
          bad={status.worker.status === "DOWN"}
        />
        {DEPENDENCIES.map(({ key, label }) => (
          <Stat
            key={key}
            label={label}
            value={ms(status[key].latencyMs)}
            bad={status[key].status === "DOWN"}
          />
        ))}
      </div>

      <div className="mt-10">
        <Section
          title="Response times & downtime"
          description="Every dependency on one scale. Red bars are minutes something was down."
          aside={
            <Legend
              items={[
                ...DEPENDENCIES.map(({ key, label }) => ({ label, className: SHADES[key]!.dot })),
                { label: "Down", className: "bg-red/30" },
              ]}
            />
          }
        >
          <OverviewChart series={series} down={view.downMinutes} from={from} to={now} unit="ms" />
        </Section>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-3">
        {DEPENDENCIES.map(({ key, label }) => {
          const latency = view.latencies.find((l) => l.key === key)!;
          return (
            <Section key={key} title={label}>
              <p className="flex items-baseline gap-2">
                <span className="text-heading text-ink">{ms(status[key].latencyMs)}</span>
                <span className="text-label text-ink-2">
                  {latency.max === null ? "no history yet" : `peak ${latency.max} ms`}
                </span>
              </p>
              <div className="mt-5">
                <LineChart points={view.points(key)} unit="ms" from={from} to={now} />
              </div>
            </Section>
          );
        })}
      </div>

      <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-2">
        <Section
          title="Availability by service"
          description="Share of the minutes in this range each part was up."
        >
          <ShareTable
            columns={[
              { label: "Service" },
              { label: "Share", align: "right", width: "5rem" },
              { label: "Minutes up", align: "right", width: "6.5rem" },
            ]}
            empty="No history in this range yet."
            rows={
              view.hasHistory
                ? view.availability.map((a) => ({
                    key: a.key,
                    share: a.share,
                    cells: [
                      a.label,
                      <span key="s" className="text-caption">
                        {a.share === null ? "—" : percent(a.share)}
                      </span>,
                      <span key="m" className="font-semibold text-ink tabular-nums">
                        {a.up.toLocaleString("en")}
                      </span>,
                    ],
                  }))
                : []
            }
          />
        </Section>

        <Section
          title="Response times"
          description="The middle, slow (1 in 20) and slowest answer in this range."
        >
          <ShareTable
            columns={[
              { label: "Dependency" },
              { label: "Median", align: "right", width: "5.5rem" },
              { label: "95th", align: "right", width: "5.5rem" },
              { label: "Slowest", align: "right", width: "5.5rem" },
            ]}
            empty="No history in this range yet."
            rows={
              view.hasHistory
                ? view.latencies.map((l) => ({
                    key: l.key,
                    cells: [
                      l.label,
                      <span key="a" className="tabular-nums">
                        {ms(l.p50)}
                      </span>,
                      <span key="b" className="tabular-nums">
                        {ms(l.p95)}
                      </span>,
                      <span key="c" className="font-semibold text-ink tabular-nums">
                        {ms(l.max)}
                      </span>,
                    ],
                  }))
                : []
            }
          />
        </Section>

        <Section
          title="Availability over time"
          description={`The ${range.short} in 48 blocks: green up, red down, grey with no samples.`}
        >
          <div className="flex flex-col gap-3">
            {TRACKED.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-[7.5rem_1fr] items-center gap-3">
                <span className="truncate text-label text-ink">{label}</span>
                <AvailabilityStrip
                  samples={view.strip(key)}
                  from={from}
                  to={now}
                  label={`${label} over the ${range.label.toLowerCase()}`}
                />
              </div>
            ))}
            <div className="grid grid-cols-[7.5rem_1fr] gap-3 text-[0.6875rem] text-ink-2">
              <span />
              <span className="flex justify-between">
                <span>{range.short} ago</span>
                <span>Now</span>
              </span>
            </div>
          </div>
        </Section>

        <Section title="Downtime" description="Every stretch a part was down in this range.">
          <ShareTable
            columns={[
              { label: "Service" },
              { label: "From", width: "8.5rem" },
              { label: "Length", align: "right", width: "5.5rem" },
            ]}
            empty="No downtime in this range."
            rows={view.stretches.slice(0, 8).map((s) => ({
              key: `${s.key}-${s.from}`,
              cells: [
                <span key="n" className="flex items-center gap-2.5">
                  <Dot up={false} />
                  {s.label}
                </span>,
                clock.format(new Date(s.from)),
                <span key="l" className="font-semibold text-ink tabular-nums">
                  {duration(s.minutes * 60_000)}
                </span>,
              ],
            }))}
          />
        </Section>

        <Section title="Services" description="Every part of the platform right now.">
          <ShareTable
            columns={[
              { label: "Service" },
              { label: "Status", width: "7rem" },
              { label: "Now", align: "right", width: "7rem" },
            ]}
            empty="Nothing to show."
            rows={services.map((s) => ({
              key: s.name,
              cells: [
                <span key="n" className="flex items-center gap-2.5">
                  <Dot up={s.status === "UP"} />
                  {s.name}
                </span>,
                s.status === "UP" ? "Operational" : <span className="text-red">Down</span>,
                <span key="d" className="text-ink tabular-nums">
                  {s.detail}
                </span>,
              ],
            }))}
          />
        </Section>

        <Section
          title="Versions"
          description="The commit each process was deployed from. Local when nothing deployed it."
        >
          <ShareTable
            columns={[
              { label: "Process" },
              { label: "Commit", width: "6rem" },
              { label: "Running since", align: "right", width: "8.5rem" },
            ]}
            empty="Nothing to show."
            rows={[
              {
                key: "server",
                cells: [
                  "Server",
                  <code key="c">{version(status.server.commit)}</code>,
                  status.server.startedAt ? clock.format(new Date(status.server.startedAt)) : "—",
                ],
              },
              {
                key: "worker",
                cells: [
                  "Worker",
                  <code key="c">
                    {status.worker.status === "UP" ? version(status.worker.commit) : "—"}
                  </code>,
                  status.worker.startedAt ? clock.format(new Date(status.worker.startedAt)) : "—",
                ],
              },
              {
                key: "web",
                cells: [
                  "Web",
                  <code key="c">{web ? version(web.commit) : "—"}</code>,
                  web ? clock.format(new Date(web.startedAt)) : "—",
                ],
              },
            ]}
          />
        </Section>
      </div>
    </>
  );
}
