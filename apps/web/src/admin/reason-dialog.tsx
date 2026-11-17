"use client";

import { useState } from "react";
import { Button } from "@/admin/button";
import { Modal } from "@/admin/dialog";
import { TextAreaField } from "@/admin/field";
import { useSubmit } from "@/admin/submit";

// The API keeps a reason with every support action (RemoveMember, TransferOwnership, SuspendStaff):
// 10 to 500 characters.
const MIN = 10;
const MAX = 500;

// "Remove …?", "Make … the owner?", "Suspend …?": the question, what happens, and the reason it's
// done, which is kept with the action. The button stays off until the reason is long enough.
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  danger = true,
  hint = "Kept on the venue's History. Say what happened and how you checked it.",
  placeholder = "The owner called support: …",
  request,
  onClose,
  onDone,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  // Under the field: who reads the reason.
  hint?: string;
  placeholder?: string;
  request: (reason: string) => Promise<{ ok: boolean; error?: unknown }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const { busy, run } = useSubmit(onDone, onClose);
  const ready = reason.trim().length >= MIN;
  return (
    <Modal
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" size="small" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="small"
            variant={danger ? "danger" : "primary"}
            loading={busy}
            disabled={!ready}
            onClick={() => void run(() => request(reason.trim()))}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <TextAreaField
        label="Reason"
        hint={hint}
        value={reason}
        maxLength={MAX}
        autoFocus
        placeholder={placeholder}
        onChange={(event) => setReason(event.target.value)}
      />
    </Modal>
  );
}
