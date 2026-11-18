"use client";

import { useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { Modal } from "@/admin/dialog";
import { send } from "@/admin/errors";
import { TextAreaField } from "@/admin/field";
import { useSubmit } from "@/admin/submit";

// Shared by a venue's Application tab and the Contact and tax section of its Details. The API takes
// a check only while the venue is provisioning.
// Recording whether the tax number checks out: Valid, or Not valid with a note saying why.
export function TaxCheckDialog({
  venueId,
  taxNumber,
  onClose,
  onDone,
}: {
  venueId: string;
  taxNumber: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const { busy, run } = useSubmit(onDone, onClose);
  const check = (valid: boolean) =>
    void run(() =>
      send(
        api.POST("/v1/admin/venues/{id}/tax-number-check", {
          params: { path: { id: venueId } },
          body: { valid, note: note.trim() || null },
        }),
      ),
    );
  return (
    <Modal
      onClose={onClose}
      title={`Check ${taxNumber}`}
      description="Record whether the number is real and belongs to the venue's business."
      footer={
        <>
          <Button variant="secondary" size="small" disabled={busy} onClick={() => check(false)}>
            Not valid
          </Button>
          <Button size="small" loading={busy} onClick={() => check(true)}>
            Valid
          </Button>
        </>
      }
    >
      <TextAreaField
        label="Note"
        hint="Optional. Kept with the check on the venue's History."
        value={note}
        maxLength={300}
        placeholder="Not found in the tax authority's register."
        onChange={(event) => setNote(event.target.value)}
      />
    </Modal>
  );
}
