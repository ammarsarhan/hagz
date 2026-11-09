"use client";

import { IconLock, IconX } from "@tabler/icons-react";
import { useEffect, useRef, type ReactNode } from "react";

// A panel that slides in from the right over a dimmed page, for editing something without leaving
// it. Built on the native <dialog> like the modals (focus trapped, Escape, the backdrop), and
// closed in two steps so the slide-out can play: `open` going false starts it, and `onExited` runs
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
        <header className="flex shrink-0 items-start justify-between gap-10 px-7 pt-7 pb-2">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2.5 text-[1.25rem] leading-[1.625rem] font-semibold text-ink">
              {title}
            </h2>
            {description ? <p className="mt-1.5 text-body text-ink-2">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            aria-label="Close"
            className="-mt-0.5 -mr-1.5 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-2 hover:bg-chip hover:text-ink"
          >
            <IconX size={20} className="size-5" stroke={1.75} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-6 pb-8">{children}</div>
        {footer ? (
          <footer className="flex shrink-0 justify-end gap-2 px-7 py-5">{footer}</footer>
        ) : null}
      </div>
    </dialog>
  );
}

// A group of fields under a heading one step larger than the field labels. Groups are split by a hairline (border-t on all but
// the first), as in the agreed design (Figma A3).
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 border-t border-border pt-6 first:border-t-0 first:pt-0">
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
      <span className="flex items-center gap-1.5 font-medium text-ink">
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
