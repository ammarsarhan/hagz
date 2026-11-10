"use client";

import { IconArrowLeft, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";

// The parts every modal and side panel is built from, after the Platform pages (the user's
// reference for the add flows, Intercom's "Add content", and the agreed panel, Figma A3), so they
// all look the same: a 20/26 semibold title with a grey line close under it and × at the far end,
// a padded body that scrolls when it's taller than the window, and small buttons at the bottom
// right. A modal's later step has ← back on its own row above the title.

export function OverlayHeader({
  title,
  description,
  onClose,
  onBack,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  // On a later step of a modal: back to the one before.
  onBack?: () => void;
}) {
  return (
    <header className={`shrink-0 px-7 pb-2 ${onBack ? "pt-5" : "pt-7"}`}>
      {/* A later step: ← and × on their own row above the title, at opposite ends. Otherwise × sits
          on the title's row at the far end, well clear of a long title. */}
      {onBack ? (
        <div className="-mx-1.5 mb-3 flex items-center justify-between">
          <IconButton label="Back" onClick={onBack}>
            <IconArrowLeft size={20} className="size-5" stroke={1.75} />
          </IconButton>
          <CloseButton onClose={onClose} />
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-10">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2.5 text-[1.25rem] leading-[1.625rem] font-semibold text-ink">
            {title}
          </h2>
          {description ? <p className="mt-1 text-body text-ink-2">{description}</p> : null}
        </div>
        {onBack ? null : (
          <div className="-mt-0.5 -mr-1.5 shrink-0">
            <CloseButton onClose={onClose} />
          </div>
        )}
      </div>
    </header>
  );
}

export function OverlayBody({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-6 pb-8">{children}</div>;
}

// Small buttons, Cancel before the one that does it.
export function OverlayFooter({ children }: { children: ReactNode }) {
  return <footer className="flex shrink-0 justify-end gap-2 px-7 py-5">{children}</footer>;
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <IconButton label="Close" onClick={onClose}>
      <IconX size={20} className="size-5" stroke={1.75} />
    </IconButton>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-8 cursor-pointer items-center justify-center rounded-full text-ink-2 hover:bg-chip hover:text-ink"
    >
      {children}
    </button>
  );
}
