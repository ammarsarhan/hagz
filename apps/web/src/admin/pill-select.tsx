"use client";

import { IconChevronDown, type Icon } from "@tabler/icons-react";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

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

// A small number box the height and shape of PillSelect, for a value set in place on a settings row
// (a percentage, a count of days), with its unit after it. Red-edged while what's typed isn't valid.
export function PillInput({
  label,
  unit,
  invalid = false,
  width = "4.5rem",
  ...input
}: {
  // What it sets, for screen readers: the row shows its label beside it.
  label: string;
  unit?: string;
  invalid?: boolean;
  width?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span
      className={`flex h-10 items-center gap-1.5 rounded-full border bg-white pr-4 pl-4 text-label font-medium text-ink transition-colors focus-within:border-ink ${
        invalid ? "border-red" : "border-border"
      }`}
    >
      <input
        aria-label={label}
        aria-invalid={invalid}
        inputMode="decimal"
        className="bg-transparent text-right tabular-nums outline-none placeholder:text-ink-3"
        style={{ width }}
        {...input}
      />
      {unit ? <span className="text-ink-3">{unit}</span> : null}
    </span>
  );
}
