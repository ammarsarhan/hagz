"use client";

import { Modal } from "@/admin/dialog";
import { DetailRow, PanelSection } from "@/admin/side-panel";
import { dateTime, eventLabel, type VenueHistoryEvent } from "./history";

const actorKind = { STAFF: "Staff", ADMIN: "Admin", SYSTEM: "System" } as const;

// One event from a venue's History, opened from its row: what it was, who did it (with their id, to
// look them up), and its payload as the API stores it, e.g. an edit's previous and new values.
export function HistoryEventModal({
  event,
  onClose,
}: {
  event: VenueHistoryEvent;
  onClose: () => void;
}) {
  const { actor } = event;
  const hasData = event.data !== undefined && event.data !== null;
  return (
    <Modal onClose={onClose} title={eventLabel(event.type)} description={dateTime(event.createdAt)}>
      <div className="flex flex-col gap-6">
        <PanelSection title="Event">
          <div>
            <DetailRow label="Type" value={<Code>{event.type}</Code>} />
            <DetailRow label="Event ID" value={<Code>{event.id}</Code>} />
          </div>
        </PanelSection>

        <PanelSection title="By">
          <div>
            <DetailRow label="Kind" value={actorKind[actor.kind]} />
            {actor.kind === "SYSTEM" ? null : (
              <>
                <DetailRow
                  label="Name"
                  value={actor.name ?? <span className="text-ink-3">Unknown</span>}
                />
                <DetailRow
                  label="User ID"
                  value={
                    actor.id ? <Code>{actor.id}</Code> : <span className="text-ink-3">None</span>
                  }
                />
              </>
            )}
          </div>
        </PanelSection>

        <PanelSection title="Payload">
          {hasData ? (
            <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-[#fafafa] p-3 font-mono text-caption leading-relaxed text-ink">
              {JSON.stringify(event.data, null, 2)}
            </pre>
          ) : (
            <p className="text-label text-ink-3">This event has no payload.</p>
          )}
        </PanelSection>
      </div>
    </Modal>
  );
}

// An id or a code, in the monospace font and selectable whole, for copying.
function Code({ children }: { children: string }) {
  return <span className="select-all font-mono text-caption">{children}</span>;
}
