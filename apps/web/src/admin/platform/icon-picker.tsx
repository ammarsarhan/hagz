"use client";

import { AMENITY_ICONS, type AmenityIcon } from "@hagz/contracts";
import { useId } from "react";
import { amenityIcons } from "./amenity-icons";

// Picks an amenity's icon: every icon in a grid of squares, in the contracts' order (facilities,
// food, sport, families, access, payment, other), with the picked one's name under it. The squares
// are native radio buttons, so arrow keys move between them and screen readers read each name.
export function IconPicker({
  value,
  onChange,
  label = "Icon",
}: {
  value: AmenityIcon | undefined;
  onChange: (icon: AmenityIcon) => void;
  label?: string;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-label font-medium text-ink-2">{label}</legend>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5">
        {AMENITY_ICONS.map((icon) => {
          const { icon: Drawn, label: title } = amenityIcons[icon];
          const picked = icon === value;
          return (
            <label
              key={icon}
              title={title}
              className={`flex aspect-square cursor-pointer items-center justify-center rounded-[0.625rem] border transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30 ${
                picked
                  ? "border-[1.5px] border-primary bg-white text-ink"
                  : "border-border text-ink-2 hover:bg-chip hover:text-ink"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={icon}
                checked={picked}
                onChange={() => onChange(icon)}
                aria-label={title}
                className="sr-only"
              />
              <Drawn size={20} className="size-5" stroke={1.75} />
            </label>
          );
        })}
      </div>
      <p className="text-caption text-ink-2" aria-live="polite">
        {value ? amenityIcons[value].label : "Pick the icon the apps show beside it."}
      </p>
    </fieldset>
  );
}
