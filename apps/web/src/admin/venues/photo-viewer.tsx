"use client";

import type { VenuePhoto } from "@hagz/contracts";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { useEffect, useRef, type ReactNode } from "react";

// One photo at full size over a dark page, with the ones before and after it a click or an arrow
// key away. On the native <dialog>, like the modals: focus stays inside, Escape closes it, and so
// does a click on the dark around the photo.
export function PhotoViewer({
  photos,
  index,
  onChange,
  onClose,
}: {
  photos: VenuePhoto[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const photo = photos[index];
  const last = photos.length - 1;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  if (!photo) return null;

  return (
    <dialog
      ref={ref}
      aria-label={`Photo ${String(index + 1)} of ${String(photos.length)}`}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" && index > 0) onChange(index - 1);
        if (event.key === "ArrowRight" && index < last) onChange(index + 1);
      }}
      onClick={(event) => {
        // The dark around the photo, not the photo or the buttons.
        if (event.target === event.currentTarget || event.target === event.currentTarget.firstChild)
          onClose();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/90"
    >
      <div className="flex h-full items-center justify-center px-20 py-16">
        {/* Storage serves the app's already-resized JPEGs from its own host: next/image would need
            that host configured and has nothing to add. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.url}
          alt={index === 0 ? "The cover photo" : `Photo ${String(index + 1)}`}
          className="max-h-full max-w-full rounded-field object-contain"
        />
      </div>

      <p className="absolute top-6 left-1/2 -translate-x-1/2 text-label font-medium text-white/80 tabular-nums">
        {index === 0 ? "Cover · " : ""}
        {index + 1} of {photos.length}
      </p>
      <ViewerButton label="Close" className="top-5 right-5" onClick={onClose}>
        <IconX size={22} className="size-[1.375rem]" stroke={1.75} />
      </ViewerButton>
      {index > 0 ? (
        <ViewerButton
          label="Previous photo"
          className="top-1/2 left-5 -translate-y-1/2"
          onClick={() => onChange(index - 1)}
        >
          <IconChevronLeft size={22} className="size-[1.375rem]" stroke={1.75} />
        </ViewerButton>
      ) : null}
      {index < last ? (
        <ViewerButton
          label="Next photo"
          className="top-1/2 right-5 -translate-y-1/2"
          onClick={() => onChange(index + 1)}
        >
          <IconChevronRight size={22} className="size-[1.375rem]" stroke={1.75} />
        </ViewerButton>
      ) : null}
    </dialog>
  );
}

function ViewerButton({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`absolute flex size-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 ${className}`}
    >
      {children}
    </button>
  );
}
