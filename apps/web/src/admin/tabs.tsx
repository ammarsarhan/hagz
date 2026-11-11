"use client";

import Link from "next/link";
import { useRef, type KeyboardEvent, type ReactNode } from "react";

// Tabs that split a page into sections, after the user's reference (Attio's Members): labels with
// a grey count on a hairline, the open one in ink with an ink underline over the hairline.
// Arrow keys move between them, as a tablist should.

export interface TabItem<T extends string> {
  id: T;
  label: string;
  // Left out while it isn't known yet.
  count?: number;
}

export function Tabs<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next]!.id);
  };

  return (
    <div role="tablist" aria-label={label} className="flex gap-6 border-b border-border">
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => move(event, index)}
            className={`-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 pb-2.5 text-label font-medium transition-colors ${
              selected ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {item.label}
            {item.count === undefined ? null : (
              <span className="text-ink-3">{item.count.toLocaleString("en")}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// The section a tab shows, labelled by its tab.
export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  );
}

// The same tabs as links, for sections that are pages of their own (a venue's dashboard): each has
// its URL, so it can be bookmarked, opened in a new tab, and reached with Back.
export function LinkTabs({
  label,
  items,
  current,
}: {
  label: string;
  items: { href: string; label: string }[];
  current: string;
}) {
  return (
    <nav aria-label={label} className="flex gap-6 border-b border-border">
      {items.map((item) => {
        const selected = item.href === current;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2.5 text-label font-medium transition-colors ${
              selected ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
