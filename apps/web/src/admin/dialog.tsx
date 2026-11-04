"use client";

import { IconX } from "@tabler/icons-react";
import { useEffect, useRef, type ReactNode } from "react";

// A modal on the browser's own <dialog>: it traps focus, closes on Escape and dims the page.
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
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
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[480px] max-w-[calc(100vw-32px)] rounded-[24px] bg-white p-0 text-ink shadow-[0_16px_48px_rgb(0_0_0/0.12)] backdrop:bg-ink/40"
    >
      <div className="px-8 pt-7 pb-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[22px] leading-[28px] font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-chip text-ink hover:bg-border"
          >
            <IconX size={18} stroke={2} />
          </button>
        </div>
        {subtitle ? <p className="mt-1.5 text-body text-ink-2">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </dialog>
  );
}
