"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./button";
import { OverlayBody, OverlayFooter, OverlayHeader } from "./overlay";
import { useSubmit } from "./submit";

// A modal on the native <dialog>: the browser traps focus, closes it on Escape and draws the
// backdrop; a click on the backdrop closes it too. Its content mounts only while open, so every
// opening starts from a fresh form.
export function Dialog({
  open,
  onClose,
  wide = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  // The chooser size (40rem), for a grid of cards; forms are 30rem.
  wide?: boolean;
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
      className={`m-auto ${wide ? "w-[40rem]" : "w-[30rem]"} max-w-[calc(100vw-2rem)] overflow-hidden rounded-card bg-white p-0 text-ink shadow-xl backdrop:bg-scrim`}
    >
      {open ? children : null}
    </dialog>
  );
}

// The admin's one modal, after the Platform pages: the shared header (title, a grey line, ×, and
// ← back on a later step), a body that scrolls inside 85% of the window, and small buttons at the
// bottom right. Wide (40rem) fits a grid of cards or a form; narrow (30rem) is for a question.
export function Modal({
  onClose,
  title,
  description,
  onBack,
  footer,
  narrow = false,
  children,
}: {
  onClose: () => void;
  title: ReactNode;
  // A line under the title about this step.
  description?: ReactNode;
  // On a later step: back to the one before.
  onBack?: () => void;
  footer?: ReactNode;
  narrow?: boolean;
  // Left out for a question that the title and description already ask.
  children?: ReactNode;
}) {
  return (
    <Dialog open wide={!narrow} onClose={onClose}>
      <div className="flex max-h-[85vh] flex-col">
        <OverlayHeader title={title} description={description} onClose={onClose} onBack={onBack} />
        {children ? <OverlayBody>{children}</OverlayBody> : <div className="h-4 shrink-0" />}
        {footer ? <OverlayFooter>{footer}</OverlayFooter> : null}
      </div>
    </Dialog>
  );
}

// A form inside a dialog: title, fields, then cancel and submit. Errors show in the HUD.
export function FormDialog({
  open,
  onClose,
  title,
  subtitle,
  submitLabel,
  busy,
  danger = false,
  onSubmit,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  submitLabel: string;
  busy: boolean;
  danger?: boolean;
  onSubmit: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <form
        className="flex flex-col p-6"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <h2 className="text-heading font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="mt-1 text-label text-ink-2">{subtitle}</p> : null}
        {children ? <div className="mt-6 flex flex-col gap-4">{children}</div> : null}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} loading={busy}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// "Delete …?", "Revoke …?": a sentence on what happens, Cancel, and the button that does it, red
// unless it's something that can't do harm (sending a link).
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
    <FormDialog
      open
      onClose={onClose}
      title={title}
      subtitle={description}
      submitLabel={confirmLabel}
      danger={danger}
      busy={busy}
      onSubmit={() => void run(request)}
    />
  );
}
