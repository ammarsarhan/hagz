"use client";

import type { ReactNode } from "react";

// Something shown on demand that slides open to its own height and fades in, and back. Its one grid
// row grows from 0fr to 1fr, so there's nothing to measure; closed, it's inert so nothing inside can
// be tabbed to. With reduced motion it just appears.
export function Reveal({
  id,
  open,
  children,
}: {
  id?: string;
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      }`}
    >
      <div inert={!open} className="overflow-hidden">
        <div
          className={`transition-opacity duration-200 ease-out motion-reduce:transition-none ${
            open ? "opacity-100" : "opacity-0"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
