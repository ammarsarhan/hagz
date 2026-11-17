"use client";

import type { SetupItemKey } from "@hagz/contracts";
import { useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { Modal } from "@/admin/dialog";
import { send } from "@/admin/errors";
import { TextAreaField } from "@/admin/field";
import { useSubmit } from "@/admin/submit";
import { setupLabel } from "./overview";

// Sending a venue in review back to its owner: the reason, which the owner reads on their checklist,
// and the sections to change, which their setup screen marks. Each picked section has to be edited
// before they can send it again; none picked, the reason says it all (user, 2026-11-18).

// The API's limits (RejectVenue).
const MIN = 10;
const MAX = 500;

export function SendBackDialog({
  venueId,
  name,
  sections,
  onClose,
  onDone,
}: {
  venueId: string;
  name: string;
  // The venue's checklist, in its order: the sections it can be asked to change.
  sections: SetupItemKey[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [picked, setPicked] = useState<SetupItemKey[]>([]);
  const { busy, run } = useSubmit(onDone, onClose);
  const ready = reason.trim().length >= MIN;

  const toggle = (key: SetupItemKey) =>
    setPicked((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );

  const submit = () =>
    void run(() =>
      send(
        api.POST("/v1/admin/venues/{id}/reject", {
          params: { path: { id: venueId } },
          // In the checklist's order, whatever order they were picked in.
          body: { reason: reason.trim(), items: sections.filter((key) => picked.includes(key)) },
        }),
      ),
    );

  return (
    <Modal
      onClose={onClose}
      title={`Send ${name} back?`}
      description="It goes back to being a draft. The owner sees your reason on their checklist."
      footer={
        <>
          <Button variant="secondary" size="small" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="small" variant="danger" loading={busy} disabled={!ready} onClick={submit}>
            Send back
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <TextAreaField
          label="Reason"
          asterisk
          required
          hint="The owner reads this. Say what to change."
          value={reason}
          maxLength={MAX}
          autoFocus
          placeholder="Add photos of the pitches themselves, not only the entrance."
          onChange={(event) => setReason(event.target.value)}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-label font-medium text-ink-2">Sections to change</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {sections.map((key) => {
              const on = picked.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(key)}
                  className={`flex h-9 cursor-pointer items-center rounded-full border px-3.5 text-label font-medium transition-colors ${
                    on
                      ? "border-ink bg-chip text-ink"
                      : "border-border bg-white text-ink-2 hover:bg-[#fafafa] hover:text-ink"
                  }`}
                >
                  {setupLabel[key]}
                </button>
              );
            })}
          </div>
          <p className="text-caption text-ink-2">
            Optional. The owner has to edit each one before sending the venue again.
          </p>
        </fieldset>
      </div>
    </Modal>
  );
}
