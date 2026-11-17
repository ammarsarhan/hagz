"use client";

import { useState } from "react";
import { Tag } from "@/admin/data-table";
import { formatMoney } from "@/admin/money";
import { DetailRow, PanelSection, SidePanel } from "@/admin/side-panel";
import {
  DAYS,
  environmentLabel,
  runsOf,
  sizeLabel,
  sportLabel,
  surfaceLabel,
  tierLabel,
  type AdminGround,
} from "./grounds";

// A ground's details, opened from the venue's layout or the list under it, read only: what kind of
// ground it is, its prices by the hour, how long a booking can be, and its week of opening hours
// with each run's price tier. The owner changes all of it in the staff app.

const hours = (count: number) => `${String(count)} ${count === 1 ? "hour" : "hours"}`;

export function GroundPanel({
  ground,
  currency,
  onClose,
}: {
  ground: AdminGround;
  currency: string;
  onClose: () => void;
}) {
  // Closing slides the panel out first; onClose (which removes it) runs once it's gone.
  const [open, setOpen] = useState(true);
  const price = (minor: number | null) =>
    minor === null ? (
      <span className="text-ink-3">Not set</span>
    ) : (
      `${formatMoney(currency, minor)}/hr`
    );
  const days = new Map(ground.schedule.map((day) => [day.dayOfWeek, day]));

  return (
    <SidePanel
      open={open}
      onRequestClose={() => setOpen(false)}
      onExited={onClose}
      title={
        <>
          {ground.name ?? "Ground"}
          {ground.status === "MAINTENANCE" ? <Tag>Paused</Tag> : null}
        </>
      }
      description={`${sportLabel[ground.sport]} · ${sizeLabel[ground.size]}`}
    >
      <div className="flex flex-col gap-6">
        <PanelSection title="Ground">
          <div>
            <DetailRow label="Sport" value={sportLabel[ground.sport]} />
            <DetailRow label="Size" value={sizeLabel[ground.size]} />
            <DetailRow label="Surface" value={surfaceLabel[ground.surface]} />
            <DetailRow label="Setting" value={environmentLabel[ground.environment]} />
          </div>
        </PanelSection>

        <PanelSection title="Prices">
          <div>
            <DetailRow label="Base" value={price(ground.basePrice)} />
            <DetailRow label="Peak" value={price(ground.peakPrice)} />
            <DetailRow label="Discount" value={price(ground.discountPrice)} />
          </div>
        </PanelSection>

        <PanelSection title="Bookings">
          <div>
            <DetailRow label="Shortest" value={hours(ground.minimumSlots)} />
            <DetailRow label="Longest" value={hours(ground.maximumSlots)} />
          </div>
        </PanelSection>

        <PanelSection title="Opening hours">
          <div>
            {DAYS.map((dayName, dayOfWeek) => {
              const day = days.get(dayOfWeek);
              const runs = day ? runsOf(day) : [];
              return (
                <div key={dayName} className="flex justify-between gap-6 py-2.5 text-label">
                  <span className="text-ink-2">{dayName}</span>
                  {runs.length === 0 ? (
                    <span className="text-ink-3">Closed</span>
                  ) : (
                    <span className="flex flex-col items-end gap-0.5">
                      {runs.map((run) => (
                        <span key={run.from} className="text-ink tabular-nums">
                          {run.label}
                          <span className="text-ink-2"> · {tierLabel[run.tier]}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </PanelSection>
      </div>
    </SidePanel>
  );
}
