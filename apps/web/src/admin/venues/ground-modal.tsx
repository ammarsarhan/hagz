"use client";

import { Tag } from "@/admin/data-table";
import { Modal } from "@/admin/dialog";
import { formatMoney } from "@/admin/money";
import { DetailRow, PanelSection } from "@/admin/side-panel";
import { environmentLabel, sizeLabel, sportLabel, surfaceLabel, type AdminGround } from "./grounds";

// A ground's details, opened from the venue's layout, read only: what kind of ground it is, its
// prices by the hour, and how long a booking can be. The owner changes all of it in the staff app.

const hours = (count: number) => `${String(count)} ${count === 1 ? "hour" : "hours"}`;

export function GroundModal({
  ground,
  currency,
  onClose,
}: {
  ground: AdminGround;
  currency: string;
  onClose: () => void;
}) {
  const price = (minor: number | null) =>
    minor === null ? (
      <span className="text-ink-3">Not set</span>
    ) : (
      `${formatMoney(currency, minor)}/hr`
    );

  return (
    <Modal
      size="narrow"
      onClose={onClose}
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
      </div>
    </Modal>
  );
}
