"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./button";
import { OverlayBody, OverlayFooter, OverlayHeader } from "./overlay";
import { useSubmit } from "./submit";

// A modal on the native <dialog>: the browser traps focus, closes it on Escape and draws the
// backdrop; a click on the backdrop closes it too. Its content mounts only while open, so every
// opening starts from a fresh form.
// Narrow (30rem) for a question, wide (40rem) for a form or a grid of cards, large (52rem) for a
// table to pick from.
const WIDTHS = {
  narrow: "w-[30rem]",
  wide: "w-[40rem]",
  large: "w-[52rem]",
  // A week laid out along the hours (a ground's details).
  wider: "w-[65rem]",
} as const;
export type DialogSize = keyof typeof WIDTHS;

export function Dialog({
  open,
  onClose,
  size = "narrow",
  children,
}: {
  open: boolean;
  onClose: () => void;
  size?: DialogSize;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // The press has to start on the backdrop as well as end there, so selecting text in a field and
  // letting go outside the modal doesn't close it.
  const pressedOutside = useRef(false);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // The content fills the <dialog> edge to edge, so the dialog itself is only hit on the backdrop.
      onMouseDown={(event) => {
        pressedOutside.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedOutside.current && event.target === event.currentTarget) onClose();
        pressedOutside.current = false;
      }}
      className={`m-auto ${WIDTHS[size]} max-w-[calc(100vw-2rem)] overflow-hidden rounded-card bg-white p-0 text-ink shadow-xl backdrop:bg-scrim`}
    >
      {open ? children : null}
    </dialog>
  );
}

// The admin's one modal, after the Platform pages: the shared header (title, a grey line, ×, and
// ← back on a later step), a body that scrolls inside 85% of the window, and small buttons at the
// bottom right. Wide (40rem) fits a grid of cards or a form, narrow (30rem) a question, and large
// (52rem) a table to pick from.
export function Modal({
  onClose,
  title,
  description,
  onBack,
  footer,
  size = "wide",
  children,
}: {
  onClose: () => void;
  title: ReactNode;
  // A line under the title about this step.
  description?: ReactNode;
  // On a later step: back to the one before.
  onBack?: () => void;
  footer?: ReactNode;
  size?: DialogSize;
  // Left out for a question that the title and description already ask.
  children?: ReactNode;
}) {
  return (
    <Dialog open size={size} onClose={onClose}>
      <div className="flex max-h-[85vh] flex-col">
        <OverlayHeader title={title} description={description} onClose={onClose} onBack={onBack} />
        {children ? <OverlayBody>{children}</OverlayBody> : <div className="h-4 shrink-0" />}
        {footer ? <OverlayFooter>{footer}</OverlayFooter> : null}
      </div>
    </Dialog>
  );
}

// "Delete …?", "Revoke …?": the question, a sentence on what happens, Cancel, and the button that
// does it, red unless it's something that can't do harm (sending a link).
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Delete",
  danger = true,
  request,
  onClose,
  onDone,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  request: () => Promise<{ ok: boolean; error?: unknown }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const { busy, run } = useSubmit(onDone, onClose);
  return (
    <Modal
      size="narrow"
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
            onClick={() => void run(request)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
