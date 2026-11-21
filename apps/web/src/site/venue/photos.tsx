"use client";

import { IconPhoto, IconX } from "@tabler/icons-react";
import { useRef } from "react";
import type { PublicVenue } from "../api";

// The photos under the venue's name (Figma W2 round 2, from W1): the cover large on the left and up
// to four more in a grid beside it, with "All N photos" opening every photo in a native <dialog>.
// Fewer photos take the room there is: one fills the width, two split it.
export function Photos({ photos, name }: { photos: PublicVenue["photos"]; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  if (photos.length === 0) return null;
  const [cover, ...rest] = photos;
  const side = rest.slice(0, 4);
  const alt = (index: number) => `Photo ${index + 1} of ${name}`;

  return (
    <>
      <div className="relative flex h-[280px] gap-2 overflow-hidden rounded-[20px] md:h-[440px]">
        {cover ? (
          <img src={cover.url} alt={alt(0)} className="h-full min-w-0 flex-1 object-cover" />
        ) : null}
        {side.length > 0 ? (
          <div
            className={`hidden min-w-0 flex-1 gap-2 md:grid ${side.length > 1 ? "grid-cols-2" : ""} ${side.length > 2 ? "grid-rows-2" : ""}`}
          >
            {side.map((photo, index) => (
              <img
                key={photo.id}
                src={photo.url}
                alt={alt(index + 1)}
                className={`size-full object-cover ${side.length === 3 && index === 0 ? "row-span-2" : ""}`}
              />
            ))}
          </div>
        ) : null}
        {photos.length > 1 ? (
          <button
            type="button"
            onClick={() => dialog.current?.showModal()}
            className="absolute right-5 bottom-5 flex h-10 items-center gap-2 rounded-full border border-ink bg-white px-[18px] text-[15px] font-semibold"
          >
            <IconPhoto size={18} stroke={1.75} />
            All {photos.length} photos
          </button>
        ) : null}
      </div>
      <dialog
        ref={dialog}
        className="m-auto max-h-[90vh] w-[min(960px,92vw)] rounded-[20px] bg-white p-0 backdrop:bg-scrim"
        onClick={(event) => {
          // A click on the backdrop lands on the dialog itself.
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="sticky top-0 flex items-center justify-between bg-white px-6 py-4">
          <div className="text-subtitle font-semibold">{name}</div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => dialog.current?.close()}
            className="flex size-10 items-center justify-center rounded-full bg-chip"
          >
            <IconX size={18} stroke={2} />
          </button>
        </div>
        <div className="flex flex-col gap-2 px-6 pb-6">
          {photos.map((photo, index) => (
            <img key={photo.id} src={photo.url} alt={alt(index)} className="w-full rounded-xl" />
          ))}
        </div>
      </dialog>
    </>
  );
}
