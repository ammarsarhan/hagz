"use client";

import type { SlotStatus, VenueSlots } from "@hagz/contracts";
import {
  IconCalendar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { useParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Skeleton } from "@/admin/data-table";
import { formatMoney } from "@/admin/money";
import { PillSelect } from "@/admin/pill-select";
import { sizeLabel, sportLabel } from "@/admin/venues/grounds";
import {
  addDays,
  hourLabel,
  localTime,
  localToday,
  useVenueSlots,
  weekStart,
  type AdminSlot,
} from "@/admin/venues/slots";
import { useFillHeight } from "@/admin/venues/use-fill-height";
import { DAY_NAMES } from "@/admin/venues/week";

// A venue's Slots tab (user, 2026-11-18): the bookable hours generated from its grounds' schedules,
// a week of one ground at a time, as Trello's planner week (the user's reference): the month with a
// picker, ‹ Today › and the ground at the top, the week's days across with today circled, the hours
// of the venue's local day down the side, and each slot a block at its time, with its price and tier,
// filled by whether it's free, held, booked or blocked; the key floats at the foot. A line marks now.
// Read only. Weeks move within the ones that have slots; days outside them are greyed. Until any
// are generated, a single line in the middle says that going live generates them.

// An hour's height, and the time column's width.
const ROW = 56;
const TIME = 64;

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

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

// "7 pm", "7:30 pm", from minutes into the day.
const timeLabel = (minutes: number) => {
  const rest = minutes % 60;
  const hour = hourLabel(Math.floor(minutes / 60));
  return rest === 0 ? hour : hour.replace(" ", `:${String(rest).padStart(2, "0")} `);
};

const dateOf = (date: string) => new Date(`${date}T12:00:00Z`);
const monthOf = (date: string, year: boolean) =>
  dateOf(date).toLocaleDateString("en-GB", {
    month: "short",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
// "Nov 2026", or "Nov – Dec 2026" for a week across two months, "Dec 2026 – Jan 2027" across years.
const weekTitle = (week: string) => {
  const end = addDays(week, 6);
  if (week.slice(0, 7) === end.slice(0, 7)) return monthOf(week, true);
  if (week.slice(0, 4) === end.slice(0, 4))
    return `${monthOf(week, false)} – ${monthOf(end, true)}`;
  return `${monthOf(week, true)} – ${monthOf(end, true)}`;
};

// The hour a ground's day starts: where the longest run of hours with no slot on any day of the
// week ends, round the clock, so a late night (4 pm – 2 am) opens on its evening, not on the hours
// after midnight. 9 am with none.
const dayStart = (used: Set<number>) => {
  if (used.size === 0 || used.size === 24) return used.size === 0 ? 9 : 0;
  let best = { length: 0, end: 0 };
  for (let start = 0; start < 24; start += 1) {
    if (used.has(start) || !used.has((start + 23) % 24)) continue;
    // A run of free hours from just after a used one.
    let length = 0;
    while (!used.has((start + length) % 24)) length += 1;
    if (length > best.length) best = { length, end: (start + length) % 24 };
  }
  return best.end;
};

export default function VenueSlotsTab() {
  const { venueId } = useParams<{ venueId: string }>();
  // The Sunday the week shown starts on: unknown until the first read says which day to open on.
  const [week, setWeek] = useState<string>();
  const { data, error, loading } = useVenueSlots(venueId, week, 7);
  const { ref, height } = useFillHeight();

  // The first read opens on today, or the nearest day with slots: show the week it's in.
  useEffect(() => {
    if (data && !week) setWeek(weekStart(data.date));
  }, [data, week]);

  // The first read may start mid-week; the week it's in is on its way.
  const midWeek = data !== undefined && data.date !== weekStart(data.date);

  return (
    <section ref={ref} className="flex w-full flex-col" style={{ height }}>
      {error && !data ? (
        <Centre>
          <p className="text-body text-ink-2">{error}</p>
        </Centre>
      ) : !data || !week || midWeek ? (
        <Skeleton className="size-full rounded-card" />
      ) : !data.days ? (
        <Centre>
          <p className="text-body font-medium text-ink">No slots yet</p>
          <p className="mt-1 max-w-[26rem] text-center text-body text-ink-2">
            Going live generates them from each ground&apos;s weekly hours, about 90 days ahead.
          </p>
        </Centre>
      ) : (
        <Planner data={data} days={data.days} loading={loading} onWeek={setWeek} />
      )}
    </section>
  );
}

function Centre({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center">{children}</div>;
}

function Planner({
  data,
  days,
  loading,
  onWeek,
}: {
  data: VenueSlots;
  // The first and last days with slots: the weeks it moves between.
  days: { first: string; last: string };
  loading: boolean;
  onWeek: (week: string) => void;
}) {
  const { date: week, timezone, grounds, slots, currency } = data;
  const [picked, setPicked] = useState<string>();
  // The ground picked, or the first while none is (or the one picked has gone).
  const ground = grounds.find((one) => one.id === picked) ?? grounds[0];
  // Now, again every minute, for today's circle and the line across it.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);
  const today = localToday(timezone, clock);
  const dates = Array.from({ length: 7 }, (_, day) => addDays(week, day));
  const end = dates[6] ?? week;

  // The ground's slots by their local day, each with its minutes into the day.
  const byDay = new Map<string, { slot: AdminSlot; from: number; to: number }[]>();
  for (const slot of slots) {
    if (slot.groundId !== ground?.id) continue;
    const start = localTime(slot.startsAt, timezone);
    const minutes = (Date.parse(slot.endsAt) - Date.parse(slot.startsAt)) / 60_000;
    const list = byDay.get(start.date) ?? [];
    // One running past midnight stops at the foot of its day.
    list.push({ slot, from: start.minutes, to: Math.min(start.minutes + minutes, 24 * 60) });
    byDay.set(start.date, list);
  }

  // Opens scrolled to just above where the ground's day starts, again when the ground changes.
  const scroller = useRef<HTMLDivElement>(null);
  const firstHour = dayStart(
    new Set([...byDay.values()].flat().map(({ from }) => Math.floor(from / 60))),
  );
  const scrolledFor = useRef<string>(undefined);
  useLayoutEffect(() => {
    if (!ground || scrolledFor.current === ground.id) return;
    scrolledFor.current = ground.id;
    scroller.current?.scrollTo({ top: Math.max(0, firstHour - 1) * ROW });
  }, [ground, firstHour]);

  const columns = `${String(TIME)}px repeat(7, minmax(7.5rem, 1fr))`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The toolbar, as the reference's: the month, the week's steps, and the ground at the far end. */}
      <div className="flex flex-wrap items-center gap-3 pb-4">
        <MonthPicker
          title={weekTitle(week)}
          week={week}
          today={today}
          days={days}
          onWeek={onWeek}
        />
        <div className="flex items-center gap-1">
          <Step
            label="Previous week"
            disabled={week <= days.first}
            onClick={() => onWeek(addDays(week, -7))}
          >
            <IconChevronLeft size={18} className="size-[1.125rem]" stroke={1.75} />
          </Step>
          <button
            type="button"
            disabled={week === weekStart(today)}
            onClick={() => onWeek(weekStart(today))}
            className="h-10 cursor-pointer rounded-full border border-border px-4 text-label font-medium text-ink outline-none hover:bg-[#fafafa] focus-visible:border-ink disabled:cursor-default disabled:text-ink-3 disabled:hover:bg-transparent"
          >
            Today
          </button>
          <Step
            label="Next week"
            disabled={end >= days.last}
            onClick={() => onWeek(addDays(week, 7))}
          >
            <IconChevronRight size={18} className="size-[1.125rem]" stroke={1.75} />
          </Step>
        </div>
        {loading ? <span className="text-caption text-ink-3">Loading…</span> : null}
        {grounds.length > 0 && ground ? (
          <div className="ml-auto">
            <PillSelect
              label="Ground"
              value={ground.id}
              onChange={(event) => setPicked(event.target.value)}
              options={grounds.map((one) => ({
                value: one.id,
                label: `${one.name ?? "Ground"} · ${
                  one.size === "STANDARD"
                    ? sportLabel[one.sport]
                    : `${sportLabel[one.sport]} ${sizeLabel[one.size]}`
                }`,
              }))}
            />
          </div>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1 border-t border-border">
        {!ground ? (
          <div className="flex size-full items-center justify-center">
            <p className="text-body text-ink-3">This venue has no grounds.</p>
          </div>
        ) : (
          <div
            ref={scroller}
            className={`size-full overflow-auto pb-24 transition-opacity ${loading ? "opacity-60" : ""}`}
          >
            <div className="grid min-w-fit" style={{ gridTemplateColumns: columns }}>
              {/* The days across the top, staying put as the hours scroll. */}
              <div className="sticky top-0 z-20 border-b border-border bg-white" />
              {dates.map((date) => (
                <DayHead key={date} date={date} today={date === today} />
              ))}

              {/* The hours down the side, each label on its line. */}
              <div className="relative" style={{ height: 24 * ROW }}>
                {HOURS.slice(1).map((hour) => (
                  <span
                    key={hour}
                    className="absolute right-3 -translate-y-1/2 text-caption text-ink-3 tabular-nums"
                    style={{ top: hour * ROW }}
                  >
                    {hourLabel(hour)}
                  </span>
                ))}
              </div>
              {dates.map((date) => (
                <Day
                  key={date}
                  date={date}
                  outside={date < days.first || date > days.last}
                  now={date === today ? localTime(new Date(clock), timezone).minutes : undefined}
                  slots={byDay.get(date) ?? []}
                  label={ground.name ?? "Ground"}
                  currency={currency}
                />
              ))}
            </div>
          </div>
        )}

        {/* What a slot's fill means, floating at the foot after the reference's bar. */}
        <Key />
      </div>
    </div>
  );
}

function DayHead({ date, today }: { date: string; today: boolean }) {
  return (
    <div className="sticky top-0 z-20 flex flex-col items-center gap-1 border-b border-border bg-white pt-3 pb-2.5">
      <span className={`text-caption ${today ? "font-semibold text-ink" : "text-ink-2"}`}>
        {DAY_NAMES[dateOf(date).getUTCDay()]?.slice(0, 3)}
      </span>
      <span
        className={`flex size-9 items-center justify-center rounded-full text-[1.125rem] font-semibold tabular-nums ${
          today ? "bg-ink text-white" : "text-ink"
        }`}
      >
        {dateOf(date).getUTCDate()}
      </span>
    </div>
  );
}

function Day({
  date,
  outside,
  now,
  slots,
  label,
  currency,
}: {
  date: string;
  // Before the first day with slots or after the last: none are generated for it.
  outside: boolean;
  // Minutes into today, on today's column.
  now: number | undefined;
  slots: { slot: AdminSlot; from: number; to: number }[];
  label: string;
  currency: string;
}) {
  return (
    <div
      className={`relative border-l border-[#f1f2f4] ${outside ? "bg-[#fafafa]" : ""}`}
      style={{
        height: 24 * ROW,
        // A hairline at each hour.
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${String(ROW - 1)}px, #f1f2f4 ${String(ROW - 1)}px ${String(ROW)}px)`,
      }}
    >
      {slots.map(({ slot, from, to }) => {
        const height = ((to - from) / 60) * ROW;
        const range = `${timeLabel(from)} – ${timeLabel(to % (24 * 60))}`;
        return (
          <div
            key={slot.id}
            title={`${label} · ${date} · ${range} · ${TIER[slot.tier]} · ${formatMoney(currency, slot.price)} · ${STATUS[slot.status]}${slot.isManual ? " · Set by staff" : ""}`}
            className={`absolute inset-x-1 flex flex-col justify-center overflow-hidden rounded-[0.5rem] px-2.5 ${statusClass[slot.status]}`}
            style={{
              top: (from / 60) * ROW + 2,
              height: Math.max(height - 4, 18),
              ...(slot.status === "BLOCKED" ? { backgroundImage: HATCH } : {}),
            }}
          >
            <span className="truncate text-label font-medium tabular-nums">
              {formatMoney(currency, slot.price)}
            </span>
            {height >= 44 ? (
              <span className="truncate text-caption opacity-70">
                {slot.status === "AVAILABLE" ? TIER[slot.tier] : STATUS[slot.status]}
                {/* Set by staff rather than the schedule. */}
                {slot.isManual ? " · Edited" : ""}
              </span>
            ) : null}
          </div>
        );
      })}

      {now !== undefined ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-ink"
          style={{ top: (now / 60) * ROW - 1 }}
        >
          <span className="absolute -top-[0.3125rem] -left-1.5 size-3 rounded-full bg-ink" />
        </div>
      ) : null}
    </div>
  );
}

// The month and a calendar under it, to jump to any week with slots.
function MonthPicker({
  title,
  week,
  today,
  days,
  onWeek,
}: {
  title: string;
  week: string;
  today: string;
  days: { first: string; last: string };
  onWeek: (week: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // The month the calendar shows, as its first day.
  const [month, setMonth] = useState(`${week.slice(0, 7)}-01`);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const shift = (months: number) => {
    const at = dateOf(month);
    at.setUTCMonth(at.getUTCMonth() + months);
    setMonth(at.toISOString().slice(0, 10));
  };
  // Six rows of weeks from the Sunday before the month's first day.
  const start = weekStart(month);
  const rows = Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, row * 7 + day)),
  );
  const lastMonth = `${days.last.slice(0, 7)}-01`;
  const firstMonth = `${days.first.slice(0, 7)}-01`;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setMonth(`${week.slice(0, 7)}-01`);
          setOpen(!open);
        }}
        className="flex h-10 cursor-pointer items-center gap-2 rounded-full px-3 text-[1.125rem] font-semibold text-ink outline-none hover:bg-chip focus-visible:ring-2 focus-visible:ring-ink"
      >
        <IconCalendar size={20} className="size-5 text-ink-2" stroke={1.75} />
        {title}
        <IconChevronDown size={16} className="size-4 text-ink-2" stroke={2} />
      </button>

      {open ? (
        <div className="absolute top-12 left-0 z-30 w-[18rem] rounded-card border border-border bg-white p-3 shadow-[0_8px_24px_rgba(11,11,12,0.12)]">
          <div className="mb-2 flex items-center justify-between">
            <Step label="Previous month" disabled={month <= firstMonth} onClick={() => shift(-1)}>
              <IconChevronLeft size={18} className="size-[1.125rem]" stroke={1.75} />
            </Step>
            <span className="text-label font-semibold text-ink">
              {dateOf(month).toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </span>
            <Step label="Next month" disabled={month >= lastMonth} onClick={() => shift(1)}>
              <IconChevronRight size={18} className="size-[1.125rem]" stroke={1.75} />
            </Step>
          </div>
          <div className="grid grid-cols-7 text-center text-caption text-ink-3">
            {DAY_NAMES.map((name) => (
              <span key={name} className="py-1">
                {name.slice(0, 2)}
              </span>
            ))}
          </div>
          {rows.map((row) => {
            const shown = row[0] === week;
            const usable = (row[6] ?? "") >= days.first && (row[0] ?? "") <= days.last;
            return (
              <button
                key={row[0]}
                type="button"
                disabled={!usable}
                onClick={() => {
                  if (row[0]) onWeek(row[0]);
                  setOpen(false);
                }}
                className={`grid w-full cursor-pointer grid-cols-7 rounded-full text-center text-label tabular-nums disabled:cursor-default ${
                  shown ? "bg-chip" : "hover:bg-[#fafafa] disabled:hover:bg-transparent"
                }`}
              >
                {row.map((date) => (
                  <span
                    key={date}
                    className={`mx-auto my-0.5 flex size-8 items-center justify-center rounded-full ${
                      date === today
                        ? "bg-ink font-semibold text-white"
                        : date.slice(0, 7) !== month.slice(0, 7) ||
                            date < days.first ||
                            date > days.last
                          ? "text-ink-3"
                          : "text-ink"
                    }`}
                  >
                    {dateOf(date).getUTCDate()}
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// What a slot's fill means: a small slot of each kind, in a bar floating at the foot.
function Key() {
  return (
    <ul className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-5 rounded-full border border-border bg-white px-5 py-2.5 text-caption whitespace-nowrap text-ink-2 shadow-[0_8px_24px_rgba(11,11,12,0.12)]">
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
      className="flex size-10 cursor-pointer items-center justify-center rounded-full text-ink outline-none hover:bg-chip focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
