"use client";

import { IconLock } from "@tabler/icons-react";
import { useEffect, useRef, type ReactNode } from "react";
import { CloseButton, OverlayFooter } from "./overlay";

// A panel that slides in from the right over a dimmed page, for editing something without leaving
// it. Its header, body and footer are the modals' (admin/overlay.tsx), so the two look the same.
// Built on the native <dialog> like the modals (focus trapped, Escape, the backdrop), and closed
// in two steps so the slide-out can play: `open` going false starts it, and `onExited` runs
// once it's over, which is where the owner removes the panel.
//
// Every way out (×, Escape, a click on the dimmed page) asks through `onRequestClose`, so the owner
// decides; it usually just sets `open` to false.
//
// It scrolls as the staff app's screens do (CompactTitle there): the title and line are the top of
// the scroll and go up with it, and once the title has gone under the bar with ×, a small copy of it
// is there instead, fading in and rising over the title's last stretch and following the scroll both
// ways. The content fades out under the bar rather than being cut against it.
const FADE = 24;
const RISE = 6;
const EDGE = 28;

// A panel has a visible title, or none and a label instead, so screen readers can still name it.
type Heading = { title: ReactNode; label?: string } | { title?: undefined; label: string };

export function SidePanel({
  open,
  onRequestClose,
  onExited,
  title,
  label,
  description,
  compact = false,
  footer,
  children,
}: Heading & {
  open: boolean;
  onRequestClose: () => void;
  onExited: () => void;
  description?: ReactNode;
  // The smaller title and line (OverlayHeader's compact), for a person's panel.
  compact?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const small = useRef<HTMLDivElement>(null);
  // Written straight onto the elements, so scrolling doesn't re-render the panel.
  const follow = () => {
    const box = scroller.current;
    if (!box) return;
    const top = box.scrollTop;
    box.style.setProperty("--edge", `${String(Math.min(top, EDGE))}px`);
    const end = heading.current?.offsetHeight ?? 0;
    const shown = Math.min(Math.max((top - (end - FADE)) / FADE, 0), 1);
    if (small.current) {
      small.current.style.opacity = String(shown);
      small.current.style.transform = `translateY(${String((1 - shown) * RISE)}px)`;
    }
  };
  // A press has to start and end on the dimmed page to close it, as with the modals.
  const pressedOutside = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label ?? (typeof title === "string" ? title : undefined)}
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
        {/* × at the far end, and the title's small copy once the big one has scrolled under. */}
        <div className="flex shrink-0 items-center justify-between gap-6 px-7 pt-5 pb-3">
          <div
            ref={small}
            // Screen readers have the big title.
            aria-hidden
            className="min-w-0 truncate text-body font-semibold text-ink"
            style={{ opacity: 0, transform: `translateY(${String(RISE)}px)` }}
          >
            {title}
          </div>
          <div className="-mr-1.5 shrink-0">
            <CloseButton onClose={onRequestClose} />
          </div>
        </div>
        <div
          ref={scroller}
          onScroll={follow}
          className="min-h-0 flex-1 overflow-y-auto px-7 pb-8"
          style={{
            maskImage: "linear-gradient(to bottom, transparent 0, black var(--edge, 0px))",
          }}
        >
          {title || description ? (
            <div ref={heading} className="pb-6">
              {title ? (
                <h2
                  className={`flex items-center gap-2.5 font-semibold text-ink ${
                    compact
                      ? "text-[1.1875rem] leading-[1.625rem]"
                      : "text-[1.25rem] leading-[1.625rem]"
                  }`}
                >
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p
                  className={compact ? "mt-1.5 text-label text-ink-2" : "mt-1 text-body text-ink-2"}
                >
                  {description}
                </p>
              ) : null}
            </div>
          ) : null}
          {children}
        </div>
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
