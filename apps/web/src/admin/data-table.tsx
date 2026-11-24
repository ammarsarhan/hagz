"use client";

import {
  IconCalendar,
  IconChevronDown,
  IconDots,
  IconSearch,
  IconX,
  type Icon,
} from "@tabler/icons-react";
import {
  FlexRender,
  type ReactTable,
  type Row,
  type RowData,
  type TableFeatures,
} from "@tanstack/react-table";
import { useEffect, useRef, useState, type ReactNode } from "react";

// The admin's one table, after the user's references (Mobbin's Skills list, Attio's Members):
// small grey headers over a hairline, quiet rows split by hairlines, a grey wash on hover.
// Pages build the TanStack table (columns, features, state); this only draws it.

export function DataTable<TFeatures extends TableFeatures, TData extends RowData>({
  table,
  widths = {},
  onRowClick,
  isSelected,
  loading = false,
  empty,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any selected state draws the same
  table: ReactTable<TFeatures, TData, any>;
  // Column widths by column id; the rest share what's left.
  widths?: Record<string, string>;
  // Rows that open something: the whole row is the target, and Enter works from the keyboard.
  onRowClick?: (row: Row<TFeatures, TData>) => void;
  // The row picked in a chooser (the area modal): shaded the light grey of a focused row, a step
  // darker than hover, until another is picked.
  isSelected?: (row: Row<TFeatures, TData>) => boolean;
  // Still fetching: grey bars stand in for the rows, under the real headers.
  loading?: boolean;
  // Shown under the headers when there are no rows.
  empty: ReactNode;
}) {
  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  const rows = table.getRowModel().rows;

  return (
    <table className="w-full table-fixed border-collapse text-body">
      <colgroup>
        {headers.map((header) => (
          <col key={header.id} style={{ width: widths[header.column.id] }} />
        ))}
      </colgroup>
      <thead>
        <tr className="border-b border-border">
          {headers.map((header) => (
            <th
              key={header.id}
              scope="col"
              className="px-3 py-2.5 text-left text-caption font-medium text-ink-2"
            >
              <FlexRender header={header} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <SkeletonRows columns={headers.map((header) => header.column.id)} />
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={headers.length} className="px-3 py-12 text-center text-label text-ink-2">
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === "Enter" && event.target === event.currentTarget)
                        onRowClick(row);
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              className={`border-b border-border transition-colors ${
                isSelected?.(row) ? "bg-[#f5f5f5]" : "hover:bg-[#fafafa]"
              } ${
                onRowClick
                  ? "cursor-pointer outline-none focus-visible:bg-[#f5f5f5] focus-visible:shadow-[inset_2px_0_0_var(--color-ink)]"
                  : ""
              }`}
            >
              {row.getAllCells().map((cell) => (
                // The "menu" column isn't clipped, so its list can hang below the row.
                <td
                  key={cell.id}
                  className={`h-12 px-3 text-ink ${cell.column.id === "menu" ? "" : "truncate"}`}
                >
                  <FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

// A grey bar that pulses while what it stands for loads.
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`block animate-pulse rounded-[0.375rem] bg-chip ${className}`} />
  );
}

// A line of text standing in while it loads: set in the text's own style, so it's exactly as tall
// as the line that replaces it (a zero-width space holds the line), with a bar across it. Nothing
// moves when the text arrives. The width goes in className.
const textStyle = {
  title: { line: "text-title", bar: "h-6" },
  subtitle: { line: "text-subtitle", bar: "h-4" },
  body: { line: "text-body", bar: "h-3.5" },
  label: { line: "text-label", bar: "h-3" },
  caption: { line: "text-caption", bar: "h-3" },
} as const;

export function SkeletonText({
  size,
  className = "",
}: {
  size: keyof typeof textStyle;
  className?: string;
}) {
  const { line, bar } = textStyle[size];
  return (
    <span aria-hidden className={`flex items-center ${line} ${className}`}>
      <Skeleton className={`w-full ${bar}`} />
      {"​"}
    </span>
  );
}

// Bar widths per row, so the stand-in rows look like text of different lengths, not a grid.
const lengths = ["w-3/5", "w-2/5", "w-1/2", "w-1/3", "w-3/4", "w-2/5"];

function SkeletonRows({ columns }: { columns: string[] }) {
  return (
    <>
      {lengths.map((_, rowIndex) => (
        <tr key={rowIndex} aria-hidden className="border-b border-border">
          {columns.map((column, columnIndex) => (
            <td key={column} className="h-12 px-3">
              {/* The menu column has no heading and stays empty. */}
              {column === "menu" ? null : (
                <Skeleton className={`h-3 ${lengths[(rowIndex + columnIndex) % lengths.length]}`} />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// The search box above a table: 36 high, a hairline, the glass on the left.
export function TableSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex h-9 w-full max-w-[20rem] items-center gap-2 rounded-[0.625rem] border border-border bg-white px-3 transition-colors focus-within:border-ink">
      <IconSearch size={16} className="size-4 shrink-0 text-ink-3" stroke={1.75} />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-label text-ink outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
      />
    </label>
  );
}

// A dropdown beside a TableSearch, the same height and shape, that narrows the table by one value,
// e.g. a venue's bookings by ground. Native, so the keyboard and screen readers get the platform's
// own picker.
export function TableFilter({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  // What it filters by, for screen readers: the toolbar shows no label.
  label: string;
}) {
  return (
    <span className="relative flex h-9 shrink-0 items-center rounded-[0.625rem] border border-border bg-white text-label text-ink transition-colors focus-within:border-ink">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-full cursor-pointer appearance-none bg-transparent pr-9 pl-3 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <IconChevronDown
        size={16}
        className="pointer-events-none absolute right-3 size-4 text-ink-3"
        stroke={1.75}
      />
    </span>
  );
}

// A day to narrow a table to, beside its search: "Any date" until one is picked, then the day and
// an × to clear it. The browser's own calendar opens from it (an invisible date input under it).
// value is YYYY-MM-DD, or "" for any day.
export function TableDate({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  // What the day means, for screen readers: "Starts on".
  label: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  // The day as written, read as a calendar day (UTC on both sides, so no zone moves it).
  const shown = value
    ? new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${value}T00:00:00Z`))
    : "Any date";
  return (
    <span className="relative flex h-9 shrink-0 items-center rounded-[0.625rem] border border-border bg-white text-label text-ink transition-colors focus-within:border-ink">
      <input
        ref={input}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pointer-events-none absolute inset-0 opacity-0"
      />
      <button
        type="button"
        aria-label={`${label}: ${shown}`}
        onClick={() => input.current?.showPicker()}
        className={`relative flex h-full cursor-pointer items-center gap-2 pl-3 outline-none ${value ? "pr-1.5" : "pr-3"}`}
      >
        <IconCalendar size={16} className="size-4 text-ink-3" stroke={1.75} />
        <span className={`tabular-nums ${value ? "text-ink" : "text-ink-2"}`}>{shown}</span>
      </button>
      {value ? (
        <button
          type="button"
          aria-label="Any date"
          onClick={() => onChange("")}
          className="relative mr-2 flex size-5 cursor-pointer items-center justify-center rounded-full text-ink-3 hover:bg-chip hover:text-ink"
        >
          <IconX size={14} className="size-3.5" stroke={2} />
        </button>
      ) : null}
    </span>
  );
}

// A small grey tag in a cell, e.g. a location's kind or a marketplace's status.
export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "on";
}) {
  return (
    <span
      className={`inline-flex rounded-[0.375rem] border px-1.5 py-px text-caption font-medium ${
        tone === "on"
          ? "border-green/20 bg-green/10 text-green"
          : "border-border bg-[#fafafa] text-ink-2"
      }`}
    >
      {children}
    </span>
  );
}

// A count in a cell, or "None" when there's nothing to count.
export function Count({ value }: { value: number }) {
  return value > 0 ? (
    <span className="text-ink-2">{value.toLocaleString("en")}</span>
  ) : (
    <span className="text-ink-3">None</span>
  );
}

export interface MenuItem {
  label: string;
  icon: Icon;
  onSelect: () => void;
  tone?: "default" | "danger";
}

// The ⋯ at the end of a row: a short list of what can be done to it. Closes on a pick, a click
// elsewhere or Escape. Clicks inside don't reach the row, so opening the menu never opens the row.
export function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative flex justify-end"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className={`flex size-7 cursor-pointer items-center justify-center rounded-[0.5rem] text-ink-2 hover:bg-chip hover:text-ink ${
          open ? "bg-chip text-ink" : ""
        }`}
      >
        <IconDots size={16} className="size-4" stroke={1.75} />
      </button>
      {open ? (
        <ul
          role="menu"
          // One inset everywhere: 6 around the items, 8 on every side inside each, and item corners
          // that follow the menu's (12 outside less the 6 between = 6).
          className="absolute top-full right-0 z-10 mt-1 w-max min-w-[11rem] rounded-card border border-border bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
        >
          {items.map(({ label: name, icon: Item, onSelect, tone }) => (
            <li key={name} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onSelect();
                }}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-[0.375rem] p-2 text-left text-label whitespace-nowrap ${
                  tone === "danger" ? "text-red hover:bg-red/10" : "text-ink hover:bg-chip"
                }`}
              >
                <Item size={16} className="size-4" stroke={1.75} />
                {name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
