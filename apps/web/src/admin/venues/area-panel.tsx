"use client";

import type { AdminLocation, AdminVenueLocation } from "@hagz/contracts";
import { IconCheck } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { Skeleton, TableSearch } from "@/admin/data-table";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";
import { SidePanel } from "@/admin/side-panel";
import { useSubmit } from "@/admin/submit";
import { formatDistance, metresBetween } from "./location";

// Setting the area a venue is listed under, in a side panel over its Location: usually the one its
// owner asked for, once it's been added under Platform › Locations. Only the marketplace's leaves
// can hold a venue (a neighbourhood or a city, not a governorate), nearest the pin first, as the
// owner's picker suggests them. The API checks the pin is close enough to the area chosen.

interface Choice {
  id: string;
  name: string;
  arabic: string;
  // The area above it: "Cairo" for Nasr City.
  within: string | null;
  // From the pin, when both have a point.
  metres: number | null;
}

export function AreaPanel({
  venueId,
  marketplaceId,
  location,
  onClose,
  onDone,
}: {
  venueId: string;
  marketplaceId: string;
  location: AdminVenueLocation;
  onClose: () => void;
  onDone: () => void;
}) {
  const [areas, setAreas] = useState<AdminLocation[]>();
  const [loadError, setLoadError] = useState<string>();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(location.area?.id);
  // Closing slides the panel out first; onClose (which removes it) runs once it's gone.
  const [open, setOpen] = useState(true);
  const hide = () => setOpen(false);
  const { busy, run } = useSubmit(onDone, hide);

  const hud = useHud();

  // Errors go to the HUD, over the panel, like every modal's (admin/submit.ts).
  const load = useCallback(async () => {
    const result = await send(
      api.GET("/v1/admin/marketplaces/{id}/locations", {
        params: { path: { id: marketplaceId } },
      }),
    );
    if (result.ok) {
      setLoadError(undefined);
      setAreas(result.data.data);
      return;
    }
    const text = message(result.error);
    setLoadError(text);
    hud(
      text,
      notTheirFault(result.error) ? { label: "Try again", run: () => void load() } : undefined,
    );
  }, [marketplaceId, hud]);

  useEffect(() => {
    void load();
  }, [load]);

  const choices = useMemo(() => {
    if (!areas) return undefined;
    const byId = new Map(areas.map((area) => [area.id, area]));
    const pin = location.coordinates;
    const list: Choice[] = areas
      .filter((area) => area.childCount === 0)
      .map((area) => ({
        id: area.id,
        name: area.names.en,
        arabic: area.names.ar,
        within: area.parentId ? (byId.get(area.parentId)?.names.en ?? null) : null,
        metres: pin && area.center ? metresBetween(pin, area.center) : null,
      }));
    // Nearest first; areas without a distance after them, by name.
    return list.sort(
      (a, b) =>
        (a.metres ?? Infinity) - (b.metres ?? Infinity) || a.name.localeCompare(b.name, "en"),
    );
  }, [areas, location.coordinates]);

  const q = query.trim().toLowerCase();
  const shown = choices?.filter(
    (choice) =>
      !q ||
      choice.name.toLowerCase().includes(q) ||
      choice.arabic.includes(query.trim()) ||
      choice.within?.toLowerCase().includes(q),
  );

  // Save stays grey until an area other than the current one is picked.
  const ready = picked !== undefined && picked !== location.area?.id;

  const submit = () => {
    if (!ready) return;
    void run(() =>
      send(
        api.PUT("/v1/admin/venues/{id}/area", {
          params: { path: { id: venueId } },
          body: { locationId: picked },
        }),
      ),
    );
  };

  return (
    <SidePanel
      open={open}
      onRequestClose={hide}
      onExited={onClose}
      title={location.area ? "Change area" : "Set area"}
      description={
        location.requestedArea
          ? `The owner asked for “${location.requestedArea}”. Add it under Platform › Locations if it isn’t here yet.`
          : "Where players find the venue. Nearest the pin first."
      }
      footer={
        <>
          <Button variant="secondary" size="small" onClick={hide} disabled={busy}>
            Cancel
          </Button>
          <Button size="small" loading={busy} disabled={!ready} onClick={submit}>
            Save changes
          </Button>
        </>
      }
    >
      <TableSearch value={query} onChange={setQuery} placeholder="Search areas…" />
      <div className="mt-4">
        {loadError && !choices ? (
          <p className="text-body text-ink-2">The areas didn’t load.</p>
        ) : !shown ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="text-body text-ink-2">
            {q ? `No area matches “${query.trim()}”.` : "This marketplace has no areas yet."}
          </p>
        ) : (
          <ul role="radiogroup" aria-label="Areas" className="flex flex-col gap-1">
            {shown.map((choice) => {
              const on = choice.id === picked;
              return (
                <li key={choice.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPicked(choice.id)}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-[0.625rem] px-3 py-2.5 text-left ${
                      on ? "bg-chip" : "hover:bg-chip"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-label font-medium text-ink">
                        {choice.name}
                        {choice.within ? (
                          <span className="font-normal text-ink-2">, {choice.within}</span>
                        ) : null}
                      </span>
                      <span dir="rtl" lang="ar" className="block truncate text-caption text-ink-3">
                        {choice.arabic}
                      </span>
                    </span>
                    {choice.metres !== null ? (
                      <span className="shrink-0 text-label text-ink-2 tabular-nums">
                        {formatDistance(choice.metres)}
                      </span>
                    ) : null}
                    <IconCheck
                      size={18}
                      className={`size-[1.125rem] shrink-0 text-ink ${on ? "" : "invisible"}`}
                      stroke={2.25}
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SidePanel>
  );
}
