"use client";

import { FOOTPRINTS, type PlacedGround, type PriceTier } from "@hagz/contracts";
import type { ReactNode } from "react";
import { Tag } from "@/admin/data-table";
import { Dialog } from "@/admin/dialog";
import { formatMoney } from "@/admin/money";
import { CloseButton } from "@/admin/overlay";
import { environmentLabel, sizeLabel, sportLabel, surfaceLabel, type AdminGround } from "./grounds";
import { DAY_NAMES, HoursGrid, TierSwatch, weekOf } from "./hours-grid";
import { PitchMarkings } from "./pitch-drawing";

// A ground's details, opened from its pitch on the venue's layout, read only (the owner changes it
// all in the staff app). Wide (user, 2026-11-18): one header across the top (its name, what it is,
// ×); under it the ground drawn to scale on the layout's grid, glowing as its pitch does when
// picked, with what it's made of beside its week on the staff app's hours grid; and along the
// bottom its prices, each by the swatch its hours wear on the grid, so the prices are the grid's key.

// The drawing's room in its column, in px.
const ROOM = { width: 320, height: 176 };

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
  const { closedDays } = weekOf(ground.schedule);
  const week =
    ground.openHours === 0
      ? "Not set yet"
      : [
          `${hours(ground.openHours)} a week`,
          closedDays.length === 0
            ? "open every day"
            : `closed ${closedDays.map((day) => DAY_NAMES[day]).join(", ")}`,
        ].join(" · ");

  return (
    <Dialog open size="large" onClose={onClose}>
      <div className="flex max-h-[85vh] flex-col overflow-y-auto">
        <header className="flex items-start justify-between gap-10 border-b border-border px-7 pt-6 pb-5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2.5 text-[1.5rem] leading-[1.875rem] font-semibold text-ink">
              <span className="truncate">{ground.name ?? "Ground"}</span>
              {ground.status === "MAINTENANCE" ? <Tag>Paused</Tag> : null}
            </h2>
            <p className="mt-1 text-body text-ink-2">
              {/* A sport with no sizes (padel, tennis…) is just its name. */}
              {ground.size === "STANDARD"
                ? sportLabel[ground.sport]
                : `${sportLabel[ground.sport]} · ${sizeLabel[ground.size]}`}
            </p>
          </div>
          <div className="-mt-0.5 -mr-1.5 shrink-0">
            <CloseButton onClose={onClose} />
          </div>
        </header>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* The ground, filling its column, over what it's made of. */}
          <div className="flex flex-col border-r border-border">
            <div
              className="flex min-h-60 flex-1 items-center justify-center bg-[#fafafa]"
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
            </div>
            <dl className="grid grid-cols-3 border-t border-border px-7">
              <Fact label="Surface">{surfaceLabel[ground.surface]}</Fact>
              <Fact label="Setting">{environmentLabel[ground.environment]}</Fact>
              <Fact label="Bookings">{bookings}</Fact>
            </dl>
          </div>

          <div className="px-7 pt-5 pb-6">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-label font-medium text-ink">Opening hours</h3>
              <p className="truncate text-caption text-ink-2">{week}</p>
            </div>
            <div className="mt-4">
              <HoursGrid schedule={ground.schedule} />
            </div>
          </div>
        </div>

        {/* The prices, each by its swatch on the grid: the grid's key. */}
        <div className="grid grid-cols-3 border-t border-border">
          <Price tier="BASE" label="Base" currency={currency} minor={ground.basePrice} />
          <Price tier="PEAK" label="Peak" currency={currency} minor={ground.peakPrice} />
          <Price
            tier="DISCOUNT"
            label="Discount"
            currency={currency}
            minor={ground.discountPrice}
          />
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

// A price by the hour as the number it is, big, under its swatch and name; one not set is a dash.
function Price({
  tier,
  label,
  currency,
  minor,
}: {
  tier: PriceTier;
  label: string;
  currency: string;
  minor: number | null;
}) {
  const amount = minor === null ? null : formatMoney(currency, minor).slice(currency.length + 1);
  return (
    <div className="px-7 py-4">
      <p className="flex items-center gap-2 text-caption text-ink-2">
        <TierSwatch tier={tier} />
        {label}
      </p>
      {amount === null ? (
        <p className="mt-1.5 text-[1.375rem] leading-[1.75rem] font-semibold text-ink-3">Not set</p>
      ) : (
        <p className="mt-1.5 flex items-baseline gap-1">
          <span className="text-caption font-medium text-ink-2">{currency}</span>
          <span className="text-[1.375rem] leading-[1.75rem] font-semibold text-ink tabular-nums">
            {amount}
          </span>
          <span className="text-caption text-ink-3">/hr</span>
        </p>
      )}
    </div>
  );
}
