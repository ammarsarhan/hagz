import { IconPhoto } from "@tabler/icons-react";
import type { PublicVenue } from "../api";

// The photos under the venue's name (Figma W2 round 2, from W1): the cover large on the left and up
// to four more in a grid beside it. Fewer photos take the room there is: one fills the width, two
// split it. A small "N photos" label says how many there are; it opens nothing (user, 2026-11-21):
// every photo is in the app.
export function Photos({ photos, name }: { photos: PublicVenue["photos"]; name: string }) {
  if (photos.length === 0) return null;
  const [cover, ...rest] = photos;
  const side = rest.slice(0, 4);
  const alt = (index: number) => `Photo ${index + 1} of ${name}`;

  return (
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
        <span className="absolute right-4 bottom-4 flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-caption font-semibold">
          <IconPhoto size={15} stroke={1.75} />
          {photos.length} photos
        </span>
      ) : null}
    </div>
  );
}
