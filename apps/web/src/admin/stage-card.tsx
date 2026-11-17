"use client";

import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useId, type ReactNode } from "react";

// One step of a process as a card (Figma A5, option 4, after Vanta's grouped progress): a numbered
// badge, the title and a line under it, a count or state on the right, and a chevron. The header
// opens and closes it; what it holds slides open beneath a hairline. Done steps show a filled check,
// the step that needs you now an outlined number, later ones a grey number and grey text.
export type StageState = "done" | "current" | "later";

export function StageCard({
  number,
  state,
  title,
  description,
  summary,
  open,
  onToggle,
  children,
}: {
  number: number;
  state: StageState;
  title: string;
  description: string;
  // The count or state on the right: "7 of 7 done", "Sent 2 days ago".
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const bodyId = useId();
  const later = state === "later";
  return (
    <section className="rounded-card border border-border bg-white">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex w-full cursor-pointer items-center gap-3.5 rounded-card px-5 py-4.5 text-left"
        >
          <Badge number={number} state={state} />
          <span className="min-w-0 flex-1">
            <span className="sr-only">{stateLabel[state]}</span>
            <span
              className={`block text-subtitle font-semibold ${later ? "text-ink-2" : "text-ink"}`}
            >
              {title}
            </span>
            <span className={`mt-0.5 block text-label ${later ? "text-ink-3" : "text-ink-2"}`}>
              {description}
            </span>
          </span>
          <span
            className={`shrink-0 text-label font-medium ${
              later ? "text-ink-3" : state === "current" ? "text-ink" : "text-ink-2"
            }`}
          >
            {summary}
          </span>
          <IconChevronDown
            aria-hidden
            size={18}
            stroke={1.75}
            className={`size-[1.125rem] shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none ${
              later ? "text-ink-3" : "text-ink-2"
            } ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h2>
      {/* Opens by growing its one grid row from 0fr to 1fr, so it slides to its own height with no
          measuring; closed, it's inert so nothing inside can be tabbed to. */}
      <div
        id={bodyId}
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div inert={!open} className="overflow-hidden">
          <div
            className={`border-t border-border p-5 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
              open ? "opacity-100" : "opacity-0"
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

// What the badge shows, for screen readers.
const stateLabel: Record<StageState, string> = {
  done: "Done: ",
  current: "Now: ",
  later: "Later: ",
};

function Badge({ number, state }: { number: number; state: StageState }) {
  const look =
    state === "done"
      ? "bg-ink text-white"
      : state === "current"
        ? "border-[1.5px] border-ink text-ink"
        : "bg-chip text-ink-3";
  return (
    <span
      aria-hidden
      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-caption font-semibold ${look}`}
    >
      {state === "done" ? <IconCheck size={16} stroke={2} className="size-4" /> : number}
    </span>
  );
}
