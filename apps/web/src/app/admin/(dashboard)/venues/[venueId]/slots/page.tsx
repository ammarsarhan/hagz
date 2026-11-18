"use client";

import type { VenueSlots, SlotStatus } from "@hagz/contracts";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Skeleton } from "@/admin/data-table";
import { formatMoney } from "@/admin/money";
import { sizeLabel, sportLabel } from "@/admin/venues/grounds";
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
// a day at a time, as a planner after Trello's (the user's reference): the day, its range of slots
// and a key of slot squares above, then a calendar filling the rest of the tab, a column per ground
// and a row per hour of the venue's local day, each slot a block with its price and tier, filled by
// whether it's free, held, booked or blocked; the day buttons float at its foot. Read only. Days
// move within the ones that have slots. Until any are generated, a single line in the middle says
// that going live generates them.

const ROW = 64;
const TIME = 64;
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
  const columns = `${String(TIME)}px repeat(${String(grounds.length)}, minmax(10rem, 1fr))`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="pb-5">
        <h2 className="text-[1.25rem] leading-[1.625rem] font-semibold text-ink">
          {longDate(date)}
        </h2>
        <p className="mt-1 text-body text-ink-2">
          Slots from {short(days.first)} to {short(days.last)}
          {loading ? <span className="text-ink-3"> · Loading…</span> : null}
        </p>
        <Key />
      </div>

      {/* The calendar fills the rest, scrolling inside; the day buttons float over its foot. */}
      <div className="relative min-h-0 flex-1 border-t border-border">
        {rows.length === 0 ? (
          <div className="flex size-full items-center justify-center">
            <p className="text-body text-ink-3">No slots on this day.</p>
          </div>
        ) : (
          <div
            className={`size-full overflow-auto pb-24 transition-opacity ${loading ? "opacity-60" : ""}`}
          >
            <div className="grid min-w-fit" style={{ gridTemplateColumns: columns }}>
              {/* The grounds across the top, staying put as the day scrolls. */}
              <div className="sticky top-0 z-10 border-b border-border bg-white" />
              {grounds.map((ground) => (
                <div
                  key={ground.id}
                  className="sticky top-0 z-10 min-w-0 border-b border-l border-[#f1f2f4] bg-white px-3 pt-3 pb-2.5"
                >
                  <p className="truncate text-label font-medium text-ink">
                    {ground.name ?? "Ground"}
                  </p>
                  <p className="truncate text-caption text-ink-3">
                    {ground.size === "STANDARD"
                      ? sportLabel[ground.sport]
                      : `${sportLabel[ground.sport]} · ${sizeLabel[ground.size]}`}
                  </p>
                </div>
              ))}

              {rows.map((row) =>
                row.kind === "fold" ? (
                  <div
                    key={`fold-${String(row.from)}`}
                    className="col-span-full border-b border-[#f1f2f4] bg-[#fafafa] py-1.5 pl-3 text-caption text-ink-3"
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

        {/* Floating, after Trello's planner bar. */}
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-white p-1 shadow-[0_8px_24px_rgba(11,11,12,0.12)]">
          <Step
            label="Previous day"
            disabled={date <= days.first}
            onClick={() => onDate(addDays(date, -1))}
          >
            <IconChevronLeft size={18} className="size-[1.125rem]" stroke={1.75} />
          </Step>
          <button
            type="button"
            disabled={date === today}
            onClick={() => onDate(today)}
            className="h-8 cursor-pointer rounded-full px-3.5 text-label font-medium text-ink outline-none hover:bg-chip focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-default disabled:text-ink-3 disabled:hover:bg-transparent"
          >
            Today
          </button>
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
      {/* The hour on its line, as in a planner. */}
      <div className="relative border-b border-[#f1f2f4]" style={{ height: ROW }}>
        <span className="absolute top-1.5 right-3 text-caption text-ink-3 tabular-nums">
          {hourLabel(hour)}
        </span>
      </div>
      {grounds.map((ground) => {
        const slot = slotAt(ground.id);
        return (
          <div
            key={ground.id}
            className="border-b border-l border-[#f1f2f4] p-1"
            style={{ height: ROW }}
          >
            {slot ? (
              <div
                title={`${ground.name ?? "Ground"} · ${hourLabel(hour)} – ${hourLabel(hour + 1)} · ${TIER[slot.tier]} · ${formatMoney(currency, slot.price)} · ${STATUS[slot.status]}${slot.isManual ? " · Set by staff" : ""}`}
                className={`flex h-full flex-col justify-center overflow-hidden rounded-[0.5rem] px-2.5 ${statusClass[slot.status]}`}
                style={slot.status === "BLOCKED" ? { backgroundImage: HATCH } : undefined}
              >
                <span className="truncate text-label font-medium tabular-nums">
                  {formatMoney(currency, slot.price)}
                </span>
                <span className="truncate text-caption opacity-70">
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

// What a slot's fill means: a small slot of each kind, under the range.
function Key() {
  return (
    <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-caption text-ink-2">
      {(Object.keys(STATUS) as SlotStatus[]).map((status) => (
        <li key={status} className="flex items-center gap-2">
          <span
            aria-hidden
            className={`size-3.5 rounded-[0.25rem] ${statusClass[status]}`}
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
      className="flex size-8 cursor-pointer items-center justify-center rounded-full text-ink outline-none hover:bg-chip focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
