"use client";

import { IconCheck, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Dialog } from "./dialog";

// The add flows' modal, after the user's reference (Intercom's "Add content"), all white: a
// title bar with × on the right, section headings over bordered cards, and buttons pinned under
// the body. A flow with more than one step gets a sidebar listing them: done steps show a check
// and what was picked, and can be clicked to go back to.

export interface Step {
  label: string;
  // What was picked there, shown under a done step ("Oman").
  value?: ReactNode;
}

export function ChooserDialog({
  onClose,
  title,
  steps,
  step = 0,
  onStep,
  heading,
  footer,
  children,
}: {
  onClose: () => void;
  // The flow's name, at the top of the sidebar (or the title bar with no steps).
  title: ReactNode;
  steps?: Step[];
  // The current step's index.
  step?: number;
  // Go back to a done step.
  onStep?: (index: number) => void;
  // The current step's own title, in the title bar beside the sidebar.
  heading?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const multi = steps !== undefined && steps.length > 1;
  return (
    <Dialog open wide onClose={onClose}>
      <div className="flex h-[min(85vh,36rem)]">
        {multi ? (
          <nav
            aria-label="Steps"
            className="flex w-[13.5rem] shrink-0 flex-col border-r border-border p-6"
          >
            <p className="text-subtitle font-semibold text-ink">{title}</p>
            <ol className="mt-6 flex flex-col gap-1">
              {steps.map((item, index) => {
                const done = index < step;
                const current = index === step;
                return (
                  <li key={item.label}>
                    <button
                      type="button"
                      disabled={!done}
                      onClick={() => onStep?.(index)}
                      aria-current={current ? "step" : undefined}
                      className={`-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-[0.625rem] px-2 py-2 text-left ${
                        done ? "cursor-pointer hover:bg-chip" : "cursor-default"
                      }`}
                    >
                      <span
                        className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold ${
                          done
                            ? "bg-ink text-white"
                            : current
                              ? "border-[1.5px] border-ink text-ink"
                              : "border border-border text-ink-3"
                        }`}
                      >
                        {done ? <IconCheck size={12} className="size-3" stroke={3} /> : index + 1}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span
                          className={`text-label ${current ? "font-semibold text-ink" : done ? "text-ink" : "text-ink-3"}`}
                        >
                          {item.label}
                        </span>
                        {done && item.value ? (
                          <span className="mt-0.5 flex items-center gap-1.5 truncate text-caption text-ink-2">
                            {item.value}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center gap-2 px-6 pt-5 pb-1">
            <h2 className="flex min-w-0 flex-1 items-center gap-2.5 text-subtitle font-semibold text-ink">
              {multi ? heading : title}
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
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-6">{children}</div>
          {footer ? (
            <footer className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
              {footer}
            </footer>
          ) : null}
        </div>
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
      <div className={`mt-3 grid gap-3 ${columns === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
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
