"use client";

import { IconChevronDown, type Icon } from "@tabler/icons-react";
import type { SelectHTMLAttributes } from "react";

// A small native select for a page's toolbar, the height and shape of a small Button (40, fully
// round) with a hairline, an optional icon on the left and a chevron on the right. Native, so the
// keyboard, screen readers and phones all get the platform's own picker.
export function PillSelect({
  icon: Lead,
  options,
  label,
  ...select
}: {
  icon?: Icon;
  options: { value: string; label: string }[];
  // What it picks, for screen readers: the toolbar shows no label.
  label: string;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative flex h-10 items-center rounded-full border border-border bg-white text-label font-medium text-ink transition-colors focus-within:border-ink hover:bg-[#fafafa]">
      {Lead ? (
        <Lead
          size={16}
          className="pointer-events-none absolute left-3.5 size-4 text-ink-2"
          stroke={1.75}
        />
      ) : null}
      <select
        aria-label={label}
        className={`h-full cursor-pointer appearance-none bg-transparent pr-9 outline-none ${Lead ? "pl-9" : "pl-4"}`}
        {...select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <IconChevronDown
        size={16}
        className="pointer-events-none absolute right-3 size-4 text-ink-2"
        stroke={1.75}
      />
    </span>
  );
}
