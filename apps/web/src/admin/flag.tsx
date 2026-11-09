"use client";

import { useState } from "react";

// A country's round flag (circle-flags, served by /admin/flags/[code]). Falls back to the code on
// a grey disc if there's no flag for it. Decorative: the country's name is always beside it.
export function Flag({ code, size = "1.5rem" }: { code: string; size?: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) {
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
  return (
    // A tiny static SVG: next/image would add nothing but a wrapper.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/admin/flags/${code.toLowerCase()}`}
      alt=""
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
      onError={() => setMissing(true)}
    />
  );
}
