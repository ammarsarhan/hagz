import type { ReactNode } from "react";

// The pieces a venue's Details sections are laid out with (Figma A6, option 5): a block is a
// heading over a hairline, with an action (Edit, Check) at its far end; a row is a grey label beside
// what it holds, each over its own hairline.

export function DetailsBlock({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-6 border-b border-border pb-3">
        <h3 className="text-body font-semibold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function DetailsRow({
  label,
  center = false,
  children,
}: {
  label: string;
  // Centres the label on a row with a button in it; text rows keep it level with their first line.
  center?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`grid grid-cols-[9.5rem_minmax(0,1fr)] gap-x-6 border-b border-border ${
        center ? "items-center py-3" : "py-4"
      }`}
    >
      <span className="text-label text-ink-2">{label}</span>
      <div>{children}</div>
    </div>
  );
}
