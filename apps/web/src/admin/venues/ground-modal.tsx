"use client";

import { FOOTPRINTS, type PlacedGround, type PriceTier } from "@hagz/contracts";
import Link from "next/link";
import { Tag } from "@/admin/data-table";
import { Dialog } from "@/admin/dialog";
import { formatMoney } from "@/admin/money";
import { CloseButton } from "@/admin/overlay";
import { environmentLabel, sizeLabel, sportLabel, surfaceLabel, type AdminGround } from "./grounds";
import { PitchMarkings } from "./pitch-drawing";
import { hourLabel, weekOf } from "./week";

// A ground's details, opened from its pitch on the venue's layout, read only (the owner changes it
// all in the staff app): Figma A7, option 2 "Programme" (97:208), picked 2026-11-18. The ground in
// one line under its name, then its week read like a TV guide: a row a day, its hours left to right
// (always 12 am through the 11 pm hour, user 2026-11-19), each run of a price tier a block with the
// price printed in it. Base light grey, peak dark, discount dashed; closed hours an empty gap, a day
// closed throughout a hairline.

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIER = { BASE: "base", PEAK: "peak", DISCOUNT: "discount" } as const;

const block: Record<PriceTier, { box: string; price: string; tier: string }> = {
  BASE: { box: "bg-[#e4e6ea]", price: "text-ink", tier: "text-ink-3" },
  PEAK: { box: "bg-ink-2", price: "text-white", tier: "text-[#d9dbdf]" },
  DISCOUNT: {
    box: "border border-dashed border-ink-3 bg-white",
    price: "text-ink-2",
    tier: "text-ink-3",
  },
};

const hours = (count: number) => `${String(count)} ${count === 1 ? "hour" : "hours"}`;

// A day's hours as runs: the same tier, or closed (null), back to back.
type Run = { tier: PriceTier | null; from: number; length: number };
const runsOf = (tierOf: (offset: number) => PriceTier | null, span: number) => {
  const runs: Run[] = [];
  for (let offset = 0; offset < span; offset += 1) {
    const tier = tierOf(offset);
    const last = runs.at(-1);
    if (last && last.tier === tier) last.length += 1;
    else runs.push({ tier, from: offset, length: 1 });
  }
  return runs;
};

export function GroundModal({
  ground,
  tile,
  currency,
  slotsHref,
  onClose,
}: {
  ground: AdminGround;
  // Where it sits on the layout, for its shape; a ground not on it is drawn at its sport's default.
  tile?: PlacedGround;
  currency: string;
  // The venue's Slots tab, where this week's hours are the bookable slots.
  slotsHref: string;
  onClose: () => void;
}) {
  const footprint = tile ?? FOOTPRINTS[ground.sport][ground.size] ?? { width: 4, height: 2 };
  const week = weekOf(ground.schedule);
  const price = (tier: PriceTier) => {
    const minor =
      tier === "PEAK"
        ? ground.peakPrice
        : tier === "DISCOUNT"
          ? ground.discountPrice
          : ground.basePrice;
    return minor === null ? "—" : formatMoney(currency, minor).slice(currency.length + 1);
  };
  // Where an hour falls along the timeline, as a share of it.
  const x = (offset: number) => `${String((offset / week.hours) * 100)}%`;
  const bookings =
    ground.minimumSlots === ground.maximumSlots
      ? hours(ground.minimumSlots)
      : `${String(ground.minimumSlots)} to ${hours(ground.maximumSlots)}`;
  const facts = [
    sportLabel[ground.sport],
    // A sport with no sizes (padel, tennis…) leaves it out.
    ...(ground.size === "STANDARD" ? [] : [sizeLabel[ground.size]]),
    surfaceLabel[ground.surface],
    environmentLabel[ground.environment],
    `Books ${bookings}`,
  ];

  return (
    <Dialog open size="wider" onClose={onClose}>
      <div className="flex max-h-[85vh] flex-col overflow-y-auto">
        <header className="flex items-start justify-between gap-10 border-b border-border px-8 pt-[1.625rem] pb-6">
          <div className="flex min-w-0 items-center gap-5">
            {/* The ground itself, small: its shape on the layout, with its sport's lines. */}
            <div
              aria-hidden
              className="relative shrink-0 border border-ink bg-white"
              style={{ width: 64, height: Math.round((64 * footprint.height) / footprint.width) }}
            >
              <PitchMarkings sport={ground.sport} {...footprint} icon />
            </div>
            <div className="min-w-0">
              <h2 className="flex items-center gap-2.5 text-[1.5rem] leading-[1.875rem] font-semibold text-ink">
                <span className="truncate">{ground.name ?? "Ground"}</span>
                {ground.status === "MAINTENANCE" ? <Tag>Paused</Tag> : null}
              </h2>
              <p className="mt-1 truncate text-label text-ink-2">{facts.join(" · ")}</p>
              <Link
                href={slotsHref}
                className="mt-2 inline-block rounded-sm text-label font-semibold text-ink underline underline-offset-4 outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                View slots
              </Link>
            </div>
          </div>
          <div className="-mt-0.5 -mr-1.5 shrink-0">
            <CloseButton onClose={onClose} />
          </div>
        </header>

        <div className="px-8 pt-7 pb-7">
          {week.hours === 0 ? (
            <p className="py-10 text-center text-body text-ink-3">No opening hours yet.</p>
          ) : (
            <div className="flex">
              {/* The days down the side, level with their rows. */}
              <div className="w-[5.125rem] shrink-0 pt-9">
                {DAYS.map((day, index) => (
                  <div
                    key={day}
                    className={`flex h-[3.375rem] items-center pb-2 text-label ${
                      week.closedDays.includes(index) ? "text-ink-3" : "font-medium text-ink"
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="relative min-w-0 flex-1">
                {/* The hours along the top, every other one, and a line at each. Noon, halfway, is
                    a step darker. */}
                <div className="relative h-9">
                  {Array.from({ length: week.hours + 1 }, (_, offset) =>
                    offset % 2 === 0 ? (
                      <span
                        key={offset}
                        className={`absolute top-0 -translate-x-1/2 text-caption whitespace-nowrap ${
                          offset === 12 ? "font-medium text-ink-2" : "text-ink-3"
                        }`}
                        style={{ left: x(offset) }}
                      >
                        {hourLabel(offset)}
                      </span>
                    ) : null,
                  )}
                </div>
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-9 bottom-2">
                  {Array.from({ length: week.hours + 1 }, (_, offset) => (
                    <span
                      key={offset}
                      className={`absolute inset-y-0 w-px ${offset === 12 ? "bg-[#c9cdd3]" : "bg-[#f1f2f4]"}`}
                      style={{ left: x(offset) }}
                    />
                  ))}
                </div>

                {DAYS.map((day, index) =>
                  week.closedDays.includes(index) ? (
                    <div key={day} className="relative flex h-[3.375rem] items-center pb-2">
                      <span className="h-px w-full bg-[#d4d6da]" />
                      <span className="absolute left-1/2 -translate-x-1/2 bg-white px-2 text-caption text-ink-3">
                        Closed all day
                      </span>
                    </div>
                  ) : (
                    <div key={day} className="relative h-[3.375rem] pb-2">
                      {runsOf((offset) => week.tierOf(index, offset), week.hours).map((run) => {
                        const style = {
                          left: `calc(${x(run.from)} + 2px)`,
                          width: `calc(${x(run.length)} - 4px)`,
                        };
                        // Closed hours stay an empty gap.
                        if (run.tier === null) return null;
                        const tone = block[run.tier];
                        const label = `${hourLabel(run.from)} – ${hourLabel(run.from + run.length)} · ${TIER[run.tier]} · ${currency} ${price(run.tier)} an hour`;
                        return (
                          <div
                            key={run.from}
                            title={label}
                            className={`absolute top-0 flex h-[2.875rem] flex-col justify-center overflow-hidden rounded-[0.375rem] px-2.5 ${tone.box}`}
                            style={style}
                          >
                            <span
                              className={`text-body leading-[1.125rem] font-medium tabular-nums ${tone.price}`}
                            >
                              {price(run.tier)}
                            </span>
                            {/* A single hour has room for its price only. */}
                            {run.length > 1 ? (
                              <span className={`text-[0.75rem] leading-[0.9375rem] ${tone.tier}`}>
                                {TIER[run.tier]}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-6 border-t border-border px-8 py-[1.125rem]">
          <p className="text-caption text-ink-3">
            {currency} per hour, printed on each block. Hours past midnight show on the next day.
          </p>
          <p className="shrink-0 text-caption font-medium text-ink-2">
            {ground.openHours === 0 ? "No hours yet" : `${hours(ground.openHours)} a week`}
          </p>
        </footer>
      </div>
    </Dialog>
  );
}
