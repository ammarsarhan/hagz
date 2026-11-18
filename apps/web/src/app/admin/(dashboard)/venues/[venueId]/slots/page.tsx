"use client";

import type { VenueSlots, SlotStatus } from "@hagz/contracts";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/admin/button";
import { Skeleton } from "@/admin/data-table";
import { formatMoney } from "@/admin/money";
import {
  addDays,
  hourLabel,
  localHour,
  longDate,
  useVenueSlots,
  type AdminSlot,
} from "@/admin/venues/slots";
import { useFillHeight } from "@/admin/venues/use-fill-height";

// A venue's Slots tab (user, 2026-11-18): the bookable hours generated from its grounds' schedules,
// a day at a time, as a calendar: a column per ground, a row per hour of the venue's local day, each
// slot with its price and tier, filled by whether it's free, held, booked or blocked. Read only.
// Days move within the ones that have slots. Until any are generated, a single line in the middle
// says that going live generates them.

const ROW = 44;
const TIME = 56;
// A run of hours with no slot on any ground this long or longer folds into one short row.
const FOLD = 3;

const TIER = { BASE: "Base", PEAK: "Peak", DISCOUNT: "Discount" } as const;
const STATUS: Record<SlotStatus, string> = {
  AVAILABLE: "Available",
  HELD: "Held",
  BOOKED: "Booked",
  BLOCKED: "Blocked",
};
const HATCH = "repeating-linear-gradient(135deg, #dcdfe3 0 1px, transparent 1px 6px)";

const statusClass: Record<SlotStatus, string> = {
  AVAILABLE: "border border-[#e3e5e9] bg-white text-ink",
  HELD: "border border-dashed border-ink-3 bg-chip text-ink",
  BOOKED: "border border-ink bg-ink text-white",
  BLOCKED: "border border-[#e3e5e9] bg-chip text-ink-3",
};

// The day's rows: an hour each where any ground has a slot, and long empty runs folded into one.
type Row = { kind: "hour"; hour: number } | { kind: "fold"; from: number; to: number };

const rowsOf = (hours: Set<number>): Row[] => {
  if (hours.size === 0) return [];
  const first = Math.min(...hours);
  const last = Math.max(...hours);
  const rows: Row[] = [];
  let hour = first;
  while (hour <= last) {
    if (hours.has(hour)) {
      rows.push({ kind: "hour", hour });
      hour += 1;
      continue;
    }
    let end = hour;
    while (!hours.has(end)) end += 1;
    if (end - hour >= FOLD) rows.push({ kind: "fold", from: hour, to: end });
    else for (let h = hour; h < end; h += 1) rows.push({ kind: "hour", hour: h });
    hour = end;
  }
  return rows;
};

export default function VenueSlotsTab() {
  const { venueId } = useParams<{ venueId: string }>();
  const [date, setDate] = useState<string>();
  const { data, error, loading } = useVenueSlots(venueId, date);
  const { ref, height } = useFillHeight();

  return (
    <section ref={ref} className="flex w-full flex-col" style={{ height }}>
      {error && !data ? (
        <Centre>
          <p className="text-body text-ink-2">{error}</p>
        </Centre>
      ) : !data ? (
        <Skeleton className="size-full rounded-card" />
      ) : !data.days ? (
        <Centre>
          <p className="text-body font-medium text-ink">No slots yet</p>
          <p className="mt-1 max-w-[26rem] text-center text-body text-ink-2">
            Going live generates them from each ground&apos;s weekly hours, about 90 days ahead.
          </p>
        </Centre>
      ) : (
        <Calendar data={data} days={data.days} loading={loading} onDate={setDate} />
      )}
    </section>
  );
}

function Centre({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center">{children}</div>;
}

function Calendar({
  data,
  days,
  loading,
  onDate,
}: {
  data: VenueSlots;
  // The first and last days with slots: the days it moves between.
  days: { first: string; last: string };
  loading: boolean;
  onDate: (date: string) => void;
}) {
  const { date, timezone, grounds, slots } = data;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  const hourOf = (slot: AdminSlot) => localHour(slot.startsAt, timezone);
  // Each ground's slots by the hour they start.
  const at = new Map(slots.map((slot) => [`${slot.groundId}:${String(hourOf(slot))}`, slot]));
  const rows = rowsOf(new Set(slots.map(hourOf)));
  const short = (day: string) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-end justify-between gap-6 pb-5">
        <div>
          <h2 className="text-[1.25rem] leading-[1.625rem] font-semibold text-ink">
            {longDate(date)}
          </h2>
          <p className="mt-1 text-body text-ink-2">
            Slots from {short(days.first)} to {short(days.last)}
            {loading ? <span className="text-ink-3"> · Loading…</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <Key />
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="small"
              disabled={date === today}
              onClick={() => onDate(today)}
            >
              Today
            </Button>
            <Step
              label="Previous day"
              disabled={date <= days.first}
              onClick={() => onDate(addDays(date, -1))}
            >
              <IconChevronLeft size={18} className="size-[1.125rem]" stroke={1.75} />
            </Step>
            <Step
              label="Next day"
              disabled={date >= days.last}
              onClick={() => onDate(addDays(date, 1))}
            >
              <IconChevronRight size={18} className="size-[1.125rem]" stroke={1.75} />
            </Step>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-card border border-border">
          <p className="text-body text-ink-3">No slots on this day.</p>
        </div>
      ) : (
        <div
          className={`min-h-0 flex-1 overflow-auto rounded-card border border-border transition-opacity ${loading ? "opacity-60" : ""}`}
        >
          <div
            className="grid min-w-fit"
            style={{
              gridTemplateColumns: `${String(TIME)}px repeat(${String(grounds.length)}, minmax(9rem, 1fr))`,
            }}
          >
            {/* The grounds across the top, staying put as the day scrolls. */}
            <div className="sticky top-0 z-10 border-b border-border bg-white" />
            {grounds.map((ground) => (
              <div
                key={ground.id}
                className="sticky top-0 z-10 truncate border-b border-l border-border bg-white px-3 py-2.5 text-label font-medium text-ink"
              >
                {ground.name ?? "Ground"}
              </div>
            ))}

            {rows.map((row) =>
              row.kind === "fold" ? (
                <div
                  key={`fold-${String(row.from)}`}
                  className="col-span-full border-b border-border bg-[#fafafa] px-3 py-1.5 text-caption text-ink-3"
                >
                  No slots {hourLabel(row.from)} – {hourLabel(row.to)}
                </div>
              ) : (
                <Hour
                  key={row.hour}
                  hour={row.hour}
                  grounds={grounds}
                  slotAt={(groundId) => at.get(`${groundId}:${String(row.hour)}`)}
                  currency={data.currency}
                />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Hour({
  hour,
  grounds,
  slotAt,
  currency,
}: {
  hour: number;
  grounds: { id: string; name: string | null }[];
  slotAt: (groundId: string) => AdminSlot | undefined;
  currency: string;
}) {
  return (
    <>
      <div
        className="border-b border-border pt-1.5 pr-2 text-right text-caption text-ink-3 tabular-nums"
        style={{ height: ROW }}
      >
        {hourLabel(hour)}
      </div>
      {grounds.map((ground) => {
        const slot = slotAt(ground.id);
        return (
          <div
            key={ground.id}
            className="border-b border-l border-border p-1"
            style={{ height: ROW }}
          >
            {slot ? (
              <div
                title={`${ground.name ?? "Ground"} · ${hourLabel(hour)} – ${hourLabel(hour + 1)} · ${TIER[slot.tier]} · ${formatMoney(currency, slot.price)} · ${STATUS[slot.status]}${slot.isManual ? " · Set by staff" : ""}`}
                className={`flex h-full items-center justify-between gap-2 rounded-[0.375rem] px-2.5 ${statusClass[slot.status]}`}
                style={slot.status === "BLOCKED" ? { backgroundImage: HATCH } : undefined}
              >
                <span className="truncate text-caption font-medium tabular-nums">
                  {formatMoney(currency, slot.price)}
                </span>
                <span className="shrink-0 text-caption opacity-70">
                  {slot.status === "AVAILABLE" ? TIER[slot.tier] : STATUS[slot.status]}
                  {/* Set by staff rather than the schedule. */}
                  {slot.isManual ? " · Edited" : ""}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

// What a slot's fill means.
function Key() {
  return (
    <ul className="flex items-center gap-4 text-caption text-ink-2">
      {(Object.keys(STATUS) as SlotStatus[]).map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`h-3 w-4 rounded-[0.1875rem] ${statusClass[status]}`}
            style={status === "BLOCKED" ? { backgroundImage: HATCH } : undefined}
          />
          {STATUS[status]}
        </li>
      ))}
    </ul>
  );
}

function Step({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-border text-ink outline-none hover:bg-chip focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
