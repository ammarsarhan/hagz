"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./button";

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
  // The chooser size (52rem), for a step list beside a grid of cards; forms are 30rem.
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
      className={`m-auto ${wide ? "w-[52rem]" : "w-[30rem]"} max-w-[calc(100vw-2rem)] overflow-hidden rounded-hud bg-white p-0 text-ink shadow-xl backdrop:bg-scrim`}
    >
      {open ? children : null}
    </dialog>
  );
}

// A form inside a dialog: title, fields, the error from the last attempt, then cancel and submit.
export function FormDialog({
  open,
  onClose,
  title,
  subtitle,
  submitLabel,
  busy,
  error,
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
  error?: string;
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
        {error ? (
          <p role="alert" className="mt-5 rounded-field bg-red/10 px-4 py-3 text-label text-red">
            {error}
          </p>
        ) : null}
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
