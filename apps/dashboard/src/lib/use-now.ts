import { useEffect, useState } from "react";
import { AppState } from "react-native";

// Timers this long are fine, but one that's due hours from now is better re-armed now and then: a
// phone that slept can fire it late, and the app coming back recomputes anyway.
const LONGEST_WAIT = 60 * 60_000;

// The current time, for text worked out from it ("30 minutes ago", "Expires in 5 hours"), redrawn
// when that text would change rather than on a fixed beat. `nextChange` says when that is, given the
// time now, or undefined when it never will. Coming back to the app redraws it too, since timers
// don't run while it's in the background. Every redraw re-arms the timer, so a long wait cut short
// by LONGEST_WAIT carries on to the change.
export function useNow(nextChange: (now: number) => number | undefined): number {
  const [now, setNow] = useState(Date.now);
  const due = nextChange(now);

  useEffect(() => {
    const timer =
      due === undefined
        ? undefined
        : setTimeout(
            () => setNow(Date.now()),
            // A beat past the change, so the redraw lands on the new text, not just before it.
            Math.min(Math.max(0, due - Date.now()) + 50, LONGEST_WAIT),
          );
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => {
      clearTimeout(timer);
      listener.remove();
    };
  }, [due, now]);

  return now;
}
