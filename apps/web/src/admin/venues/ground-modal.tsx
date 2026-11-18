"use client";

import { FOOTPRINTS, type PlacedGround } from "@hagz/contracts";
import type { ReactNode } from "react";
import { Tag } from "@/admin/data-table";
import { Dialog } from "@/admin/dialog";
import { formatMoney } from "@/admin/money";
import { CloseButton } from "@/admin/overlay";
import { environmentLabel, sizeLabel, sportLabel, surfaceLabel, type AdminGround } from "./grounds";
import { HoursGrid } from "./hours-grid";
import { PitchMarkings } from "./pitch-drawing";

// A ground's details, opened from its pitch on the venue's layout, read only (the owner changes it
// all in the staff app). It opens on the ground itself: drawn to scale with its sport's markings,
// on the layout's grid, glowing as its pitch does when picked. Then what it is, how long a booking
// can be, its prices by the hour, and its week as the staff app's hours grid draws it.

// The drawing's room in the modal's head, in px.
const ROOM = { width: 300, height: 128 };

const hours = (count: number) => `${String(count)} ${count === 1 ? "hour" : "hours"}`;

export function GroundModal({
  ground,
  tile,
  currency,
  onClose,
}: {
  ground: AdminGround;
  // Where it sits on the layout, for its size; a ground not on it is drawn at its sport's default.
  tile?: PlacedGround;
  currency: string;
  onClose: () => void;
}) {
  const footprint = tile ?? FOOTPRINTS[ground.sport][ground.size] ?? { width: 4, height: 2 };
  // Whole pixels a cell, like the layout, so the grid behind lines up with the ground's edges.
  const cell = Math.floor(Math.min(ROOM.width / footprint.width, ROOM.height / footprint.height));
  const drawn = { width: footprint.width * cell, height: footprint.height * cell };
  const bookings =
    ground.minimumSlots === ground.maximumSlots
      ? hours(ground.minimumSlots)
      : `${String(ground.minimumSlots)} to ${hours(ground.maximumSlots)}`;

  return (
    <Dialog open size="narrow" onClose={onClose}>
      <div className="flex max-h-[85vh] flex-col overflow-y-auto">
        <div
          className="relative flex h-52 shrink-0 items-center justify-center border-b border-border bg-[#fafafa]"
          style={{
            // The layout's grid, a cell to every 10 m, lined up with the ground's edges.
            backgroundImage:
              "linear-gradient(to right, #eef0f2 1px, transparent 1px), linear-gradient(to bottom, #eef0f2 1px, transparent 1px)",
            backgroundSize: `${String(cell)}px ${String(cell)}px`,
            backgroundPosition: `calc(50% + ${String(cell / 2 - drawn.width / 2)}px) calc(50% + ${String(cell / 2 - drawn.height / 2)}px)`,
          }}
        >
          <div
            className={`relative rounded-[0.25rem] border-[1.5px] border-[#c9cdd3] bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.85),0_0_28px_rgba(11,11,12,0.16)] ${
              ground.status === "MAINTENANCE" ? "opacity-60" : ""
            }`}
            style={drawn}
          >
            <PitchMarkings sport={ground.sport} {...footprint} />
          </div>
          <div className="absolute top-3 right-3 rounded-full bg-white/80 backdrop-blur-sm">
            <CloseButton onClose={onClose} />
          </div>
        </div>

        <div className="px-7 pt-6 pb-7">
          <h2 className="flex items-center gap-2.5 text-[1.5rem] leading-[1.875rem] font-semibold text-ink">
            {ground.name ?? "Ground"}
            {ground.status === "MAINTENANCE" ? <Tag>Paused</Tag> : null}
          </h2>
          <p className="mt-1 text-body text-ink-2">
            {/* A sport with no sizes (padel, tennis…) is just its name. */}
            {ground.size === "STANDARD"
              ? sportLabel[ground.sport]
              : `${sportLabel[ground.sport]} · ${sizeLabel[ground.size]}`}
          </p>

          <dl className="mt-6 grid grid-cols-3 border-y border-border">
            <Fact label="Surface">{surfaceLabel[ground.surface]}</Fact>
            <Fact label="Setting">{environmentLabel[ground.environment]}</Fact>
            <Fact label="Bookings">{bookings}</Fact>
          </dl>

          <h3 className="mt-6 text-label text-ink-2">Per hour</h3>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <Price label="Base" currency={currency} minor={ground.basePrice} />
            <Price label="Peak" currency={currency} minor={ground.peakPrice} />
            <Price label="Discount" currency={currency} minor={ground.discountPrice} />
          </div>

          <div className="mt-7 flex items-baseline justify-between gap-6">
            <h3 className="text-label text-ink-2">Opening hours</h3>
            <p className="text-caption text-ink-3 tabular-nums">
              {ground.openHours === 0
                ? "Not set yet"
                : `${String(ground.openHours)} ${ground.openHours === 1 ? "hour" : "hours"} a week`}
            </p>
          </div>
          <div className="mt-3">
            <HoursGrid schedule={ground.schedule} />
          </div>
        </div>
      </div>
    </Dialog>
  );
}

// One of the strip's three: a grey label over its value, hairlines between them.
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border py-3.5 not-first:border-l not-first:pl-4">
      <dt className="text-caption text-ink-2">{label}</dt>
      <dd className="mt-0.5 text-body text-ink">{children}</dd>
    </div>
  );
}

// A price as the number it is, big, its currency small beside it; one not set is a grey dash.
function Price({
  label,
  currency,
  minor,
}: {
  label: string;
  currency: string;
  minor: number | null;
}) {
  const amount = minor === null ? null : formatMoney(currency, minor).slice(currency.length + 1);
  return (
    <div className="rounded-card bg-[#fafafa] px-4 py-3.5">
      <p className="text-caption text-ink-2">{label}</p>
      {amount === null ? (
        <p className="mt-1 text-[1.375rem] leading-[1.75rem] font-semibold text-ink-3">—</p>
      ) : (
        <p className="mt-1 flex items-baseline gap-1">
          <span className="text-caption font-medium text-ink-2">{currency}</span>
          <span className="text-[1.375rem] leading-[1.75rem] font-semibold text-ink tabular-nums">
            {amount}
          </span>
        </p>
      )}
    </div>
  );
}
