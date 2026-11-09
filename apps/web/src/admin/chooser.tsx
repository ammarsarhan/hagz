"use client";

import { IconArrowLeft, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Dialog } from "./dialog";

// The add flows' modal, after the user's reference (Intercom's "Add content"): a white title bar
// with × on the right, a grey body with section headings over white cards, and, once a card is
// picked, a form in the same frame with ← back to the cards.

export function ChooserDialog({
  onClose,
  title,
  onBack,
  footer,
  children,
}: {
  onClose: () => void;
  title: ReactNode;
  // Shown on the form step: back to the cards.
  onBack?: () => void;
  // Buttons pinned under the body (the form step).
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open wide onClose={onClose}>
      <div className="flex max-h-[min(85vh,52rem)] flex-col">
        <header className="flex shrink-0 items-center gap-2 px-6 py-4">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="-ml-1.5 flex size-8 cursor-pointer items-center justify-center rounded-full text-ink-2 hover:bg-chip hover:text-ink"
            >
              <IconArrowLeft size={18} className="size-[1.125rem]" stroke={1.75} />
            </button>
          ) : null}
          <h2 className="flex min-w-0 flex-1 items-center gap-2.5 text-subtitle font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 flex size-8 cursor-pointer items-center justify-center rounded-full text-ink-2 hover:bg-chip hover:text-ink"
          >
            <IconX size={18} className="size-[1.125rem]" stroke={1.75} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f7f8] px-6 pt-5 pb-6">{children}</div>
        {footer ? (
          <footer className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </Dialog>
  );
}

// A heading over a group of cards, like the reference's "Create new content".
export function ChooserSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-body font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-0.5 text-label text-ink-2">{description}</p> : null}
      <div className="mt-3 grid grid-cols-3 gap-3">{children}</div>
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
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-[#fafafa] px-2 py-0.5 text-caption font-medium text-ink-2">
      {children}
    </span>
  );
}
