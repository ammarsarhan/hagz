"use client";

import { useState } from "react";

// How many times a flag that failed to load is asked for again before the code is shown instead.
// One failed request (the dev server compiling the route, a dropped connection) shouldn't leave the
// code on screen for good.
const RETRIES = 2;

// A country's round flag (circle-flags, served by /admin/flags/[code]). Falls back to the code on
// a grey disc only if the flag still won't load after the retries, e.g. a code with no flag.
// Decorative: the country's name is always beside it.
export function Flag({ code, size = "1.5rem" }: { code: string; size?: string }) {
  const [failures, setFailures] = useState(0);

  if (failures > RETRIES) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-full bg-chip text-[0.625rem] font-semibold text-ink-2"
      >
        {code}
      </span>
    );
  }

  const src = `/admin/flags/${code.toLowerCase()}`;
  return (
    // A tiny static SVG: next/image would add nothing but a wrapper.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      // A new key and URL per attempt, so the browser asks again instead of reusing the failure.
      key={failures}
      src={failures ? `${src}?retry=${failures}` : src}
      alt=""
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
      onError={() => setTimeout(() => setFailures((count) => count + 1), 500 * (failures + 1))}
    />
  );
}
