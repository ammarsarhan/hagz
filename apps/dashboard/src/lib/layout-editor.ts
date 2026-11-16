import type { VenueLayout, VenueLayoutView } from "@hagz/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useHud } from "@/components/hud";
import { api } from "./api";
import { hudMessage, send } from "./api-errors";
import { afterVenueWrite, queries } from "./queries";

// The layout being edited (Figma "Layout", 376:2–378:2). There's no Save button, as with Payments:
// each finished change (a drop, a turn, a removal) shows at once and is saved behind it. Changes
// come in bursts, so saves queue: one request at a time, always with the newest layout, so a slow
// answer never undoes a newer arrangement. If a save is refused, the HUD says why and the layout
// goes back to what was last saved.

const plain = (layout: VenueLayout): VenueLayout => ({
  columns: layout.columns,
  rows: layout.rows,
  grounds: layout.grounds,
  amenities: layout.amenities,
  entrances: layout.entrances,
});

export function useLayoutEditor(venueId: string, start: VenueLayoutView) {
  const queryClient = useQueryClient();
  const hud = useHud();
  const [plan, setPlan] = useState<VenueLayout>(() => plain(start));
  const saved = useRef<VenueLayout>(plain(start));
  const waiting = useRef<VenueLayout | null>(null);
  const sending = useRef(false);

  const flush = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    while (waiting.current) {
      const body = waiting.current;
      waiting.current = null;
      const result = await send(
        api.PUT("/v1/staff/venues/{venueId}/layout", { params: { path: { venueId } }, body }),
      );
      if (!result.ok) {
        // Anything queued behind it was built on the refused layout: drop it too.
        waiting.current = null;
        setPlan(saved.current);
        hud.show(hudMessage(result.error));
        break;
      }
      saved.current = plain(result.data);
      queryClient.setQueryData(queries.layout(venueId).queryKey, result.data);
    }
    sending.current = false;
    // Placing the last ground finishes the checklist item; the draft card's "Last updated" moves.
    void afterVenueWrite(queryClient, venueId);
  }, [hud, queryClient, venueId]);

  const change = useCallback(
    (next: VenueLayout) => {
      setPlan(next);
      waiting.current = next;
      void flush();
    },
    [flush],
  );

  return { plan, change };
}
