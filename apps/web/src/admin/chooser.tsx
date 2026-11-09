"use client";

import { IconArrowLeft, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Dialog } from "./dialog";

// The add flows' modal, after the user's reference (Intercom's "Add content"), all white: a title
// bar with ← back (on a later step) and × at opposite ends above the step's title and a line under it,
// bordered cards, and buttons pinned under the body.

export function ChooserDialog({
  onClose,
  title,
  description,
  onBack,
  footer,
  children,
}: {
  onClose: () => void;
  title: ReactNode;
  // A line under the title about this step.
  description?: ReactNode;
  // On a later step: back to the one before.
  onBack?: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open wide onClose={onClose}>
      <div className="flex max-h-[85vh] flex-col">
        <header className="shrink-0 px-7 pt-5 pb-2">
          {/* ← and × on their own row above the title, at opposite edges. */}
          <div className="-mx-1.5 flex items-center justify-between">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="flex size-8 cursor-pointer items-center justify-center rounded-full text-ink-2 hover:bg-chip hover:text-ink"
              >
                <IconArrowLeft size={20} className="size-5" stroke={1.75} />
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 cursor-pointer items-center justify-center rounded-full text-ink-2 hover:bg-chip hover:text-ink"
            >
              <IconX size={20} className="size-5" stroke={1.75} />
            </button>
          </div>
          <h2
            // Under ← the title needs room to read as its own line; under × alone it sits closer.
            className={`${onBack ? "mt-3" : "mt-0.5"} flex items-center gap-2.5 text-[1.25rem] leading-[1.625rem] font-semibold text-ink`}
          >
            {title}
          </h2>
          {description ? <p className="mt-1.5 text-body text-ink-2">{description}</p> : null}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-6 pb-8">{children}</div>
        {footer ? (
          <footer className="flex shrink-0 justify-end gap-2 px-7 py-5">{footer}</footer>
        ) : null}
      </div>
    </Dialog>
  );
}

// A heading over a group of cards, like the reference's "Create new content".
export function ChooserSection({
  title,
  description,
  columns = 3,
  children,
}: {
  title?: string;
  description?: string;
  columns?: 2 | 3;
  children: ReactNode;
}) {
  return (
    <section className="mt-6 first:mt-0">
      {title ? <h3 className="text-body font-semibold text-ink">{title}</h3> : null}
      {description ? <p className="mt-0.5 text-label text-ink-2">{description}</p> : null}
      <div
        className={`${title || description ? "mt-3" : ""} grid gap-3 ${columns === 2 ? "grid-cols-2" : "grid-cols-3"}`}
      >
        {children}
      </div>
    </section>
  );
}

// One choice: an optional tag and icon on top, a title, and a line under it. A disabled card stays
// in the grid (so the set reads complete) but can't be picked.
export function ChoiceCard({
  icon,
  tag,
  title,
  description,
  disabled = false,
  onSelect,
}: {
  icon?: ReactNode;
  tag?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="flex min-h-[5.5rem] cursor-pointer flex-col items-start rounded-card border border-border bg-white p-4 text-left transition-[border-color,box-shadow] hover:border-[#d5d8dd] hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)] focus-visible:border-ink focus-visible:outline-none disabled:cursor-default disabled:opacity-50 disabled:hover:border-border disabled:hover:shadow-none"
    >
      {tag ? <span className="mb-2.5">{tag}</span> : null}
      {icon ? (
        <span className="mb-3 flex size-8 items-center justify-center rounded-full bg-chip text-ink">
          {icon}
        </span>
      ) : null}
      <span className="flex items-center gap-2 text-body font-semibold text-ink">{title}</span>
      {description ? (
        <span className="mt-1 text-label leading-snug text-ink-2">{description}</span>
      ) : null}
    </button>
  );
}

// The small rounded label on a card, like the reference's "Document" / "Internal article".
export function ChoiceTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2 py-0.5 text-caption font-medium text-ink-2">
      {children}
    </span>
  );
}
