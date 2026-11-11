import type { ReactNode } from "react";

// Home's pieces, after Gumloop's Insights (the user's reference of 2026-11-11): small grey labels
// over big figures, then sections with a title and a line under it, each a table whose rows can
// carry a grey bar for their share.

// A headline figure: the label small and grey, the value big. Red when it's bad news.
export function Stat({
  label,
  value,
  bad = false,
}: {
  label: string;
  value: string;
  bad?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-caption text-ink-2">{label}</p>
      <p
        className={`mt-1.5 truncate text-title font-semibold tabular-nums ${bad ? "text-red" : "text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}

export function Section({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description?: string;
  // On the right of the title, e.g. a legend.
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-subtitle font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-label text-ink-2">{description}</p> : null}
        </div>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export interface Column {
  label: string;
  // Figures sit on the right, under a right-aligned heading.
  align?: "left" | "right";
  width?: string;
}

export interface TableRow {
  key: string;
  cells: ReactNode[];
  // 0–1: a grey bar behind the row this much of its width, as in the reference's shares.
  share?: number | null;
}

// The reference's tables: small grey headings, then rows 40 high on a 6-corner grey bar for their
// share (or none), the first cell in ink and the rest in grey or as figures.
export function ShareTable({
  columns,
  rows,
  empty,
}: {
  columns: Column[];
  rows: TableRow[];
  empty: string;
}) {
  const template = columns.map((column) => column.width ?? "1fr").join(" ");
  const cell = (column: Column | undefined) =>
    `min-w-0 truncate px-2 ${column?.align === "right" ? "text-right" : ""}`;

  return (
    <div role="table" className="text-label">
      <div role="row" className="grid pb-1.5" style={{ gridTemplateColumns: template }}>
        {columns.map((column) => (
          <span
            key={column.label}
            role="columnheader"
            className={`${cell(column)} text-caption font-medium text-ink-2`}
          >
            {column.label}
          </span>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-[0.625rem] border border-dashed border-border px-4 py-3 text-center text-label text-ink-2">
          {empty}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {rows.map((row) => (
            <div
              key={row.key}
              role="row"
              className="relative grid h-10 items-center"
              style={{ gridTemplateColumns: template }}
            >
              {row.share != null ? (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-[0.375rem] bg-chip"
                  style={{ width: `${Math.max(0, Math.min(1, row.share)) * 100}%` }}
                />
              ) : null}
              {row.cells.map((content, i) => (
                <span
                  key={i}
                  role="cell"
                  className={`relative ${cell(columns[i])} ${i === 0 ? "text-ink" : "text-ink-2"}`}
                >
                  {content}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// A status dot, 10 square with soft corners: green while it answers, red when it doesn't.
export const Dot = ({ up }: { up: boolean }) => (
  <span
    className={`inline-block size-2.5 shrink-0 rounded-[0.1875rem] ${up ? "bg-green" : "bg-red"}`}
  />
);
