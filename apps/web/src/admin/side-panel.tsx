"use client";

import { IconLock } from "@tabler/icons-react";
import { useEffect, useRef, type ReactNode } from "react";
import { OverlayBody, OverlayFooter, OverlayHeader } from "./overlay";

// A panel that slides in from the right over a dimmed page, for editing something without leaving
// it. Its header, body and footer are the modals' (admin/overlay.tsx), so the two look the same.
// Built on the native <dialog> like the modals (focus trapped, Escape, the backdrop), and closed
// in two steps so the slide-out can play: `open` going false starts it, and `onExited` runs
// once it's over, which is where the owner removes the panel.
//
// Every way out (×, Escape, a click on the dimmed page) asks through `onRequestClose`, so the owner
// decides; it usually just sets `open` to false.

export function SidePanel({
  open,
  onRequestClose,
  onExited,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onRequestClose: () => void;
  onExited: () => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // A press has to start and end on the dimmed page to close it, as with the modals.
  const pressedOutside = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      data-closing={open ? undefined : ""}
      // Escape: let the owner close it (with the slide-out) instead of the browser, at once.
      onCancel={(event) => {
        event.preventDefault();
        onRequestClose();
      }}
      onMouseDown={(event) => {
        pressedOutside.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedOutside.current && event.target === event.currentTarget) onRequestClose();
        pressedOutside.current = false;
      }}
      onAnimationEnd={(event) => {
        // The panel's own slide-out, not the backdrop's fade or anything inside.
        if (event.target !== event.currentTarget || event.animationName !== "panel-out") return;
        ref.current?.close();
        onExited();
      }}
      className="side-panel fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[32rem] max-w-full bg-white p-0 text-ink shadow-[-12px_0_40px_rgba(0,0,0,0.12)] backdrop:bg-scrim"
    >
      <div className="flex h-full flex-col">
        <OverlayHeader title={title} description={description} onClose={onRequestClose} />
        <OverlayBody>{children}</OverlayBody>
        {footer ? <OverlayFooter>{footer}</OverlayFooter> : null}
      </div>
    </dialog>
  );
}

// A group of fields under a heading one step larger than the field labels. Groups are split by a hairline (border-t on all but
// the first), as in the agreed design (Figma A3).
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 border-t border-border/75 pt-6 first:border-t-0 first:pt-0">
      <h3 className="text-body font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

// Something shown for reference that can't change here: label on the left, value and a lock on the
// right, instead of a greyed-out input.
export function ReadOnlyRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-2.5 text-label">
      <span className="text-ink-2">{label}</span>
      <span className="flex items-center gap-1.5 text-ink">
        {value}
        <IconLock
          size={14}
          className="size-3.5 text-ink-3"
          stroke={2}
          aria-label="Can't be changed"
        />
      </span>
    </div>
  );
}

// A fact about what the panel shows, for viewing rather than editing: label on the left, value on
// the right, without ReadOnlyRow's lock.
export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-2.5 text-label">
      <span className="text-ink-2">{label}</span>
      <span className="min-w-0 truncate text-right text-ink">{value}</span>
    </div>
  );
}
