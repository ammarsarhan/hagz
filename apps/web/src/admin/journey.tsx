import { IconCheck } from "@tabler/icons-react";
import type { ReactNode } from "react";

// One step of a journey down the page (Figma A5, option 2, after Revolut's approval timeline): a
// marker on a vertical line, the step's title and a line under it, then whatever it holds. Done steps
// have a filled check and an ink line down to the next; the step that needs you now an outlined dot;
// later ones a grey ring, grey text and a grey line.
export type JourneyState = "done" | "current" | "later";

export function JourneyStep({
  state,
  title,
  meta,
  last = false,
  children,
}: {
  state: JourneyState;
  title: string;
  meta: string;
  // The last step has no line below it.
  last?: boolean;
  children?: ReactNode;
}) {
  const later = state === "later";
  return (
    <li className="flex gap-4">
      <div aria-hidden className="flex w-[1.375rem] shrink-0 flex-col items-center">
        <Marker state={state} />
        {last ? null : (
          <span className={`my-1 w-[1.5px] flex-1 ${state === "done" ? "bg-ink" : "bg-border"}`} />
        )}
      </div>
      <div className={`-mt-0.5 min-w-0 flex-1 ${last ? "" : "pb-8"}`}>
        {/* The title's line is as tall as the marker, and the text 2px up from centre: the optical
            match for a cap-height title beside a circle. */}
        <h2
          className={`text-subtitle leading-[1.375rem] font-semibold ${later ? "text-ink-2" : "text-ink"}`}
        >
          <span className="sr-only">{stateLabel[state]}</span>
          {title}
        </h2>
        <p className={`mt-0.5 text-label ${later ? "text-ink-3" : "text-ink-2"}`}>{meta}</p>
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </li>
  );
}

// What the marker shows, for screen readers.
const stateLabel: Record<JourneyState, string> = {
  done: "Done: ",
  current: "Now: ",
  later: "Later: ",
};

function Marker({ state }: { state: JourneyState }) {
  if (state === "done") {
    return (
      <span className="flex size-[1.375rem] items-center justify-center rounded-full bg-ink text-white">
        <IconCheck size={14} stroke={2.25} className="size-3.5" />
      </span>
    );
  }
  return (
    <span
      className={`flex size-[1.375rem] items-center justify-center rounded-full border-[1.5px] ${
        state === "current" ? "border-ink" : "border-ink-3"
      }`}
    >
      {state === "current" ? <span className="size-2 rounded-full bg-ink" /> : null}
    </span>
  );
}
