import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import type { components } from "@hagz/api";
import { useHud } from "@/components/hud";
import { hudMessage, type Result } from "./api-errors";
import { queries } from "./queries";

export type VenueDetail = components["schemas"]["StaffVenueDetail"];

// Saving a setup item's screen: send its requests one after another, put the venue each answers with
// in the cache, then go back to the checklist. Everything under the venue is refetched after, so the
// checklist ticks the item and the draft card's "2m ago" moves (both read other keys).
//
// A failure stops there and is handed back, for the screen to put under its field when it's the
// person's to fix; anything else goes to the HUD.
export function useSaveVenue(venueId: string) {
  const queryClient = useQueryClient();
  const hud = useHud();
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (
      requests: (() => Promise<Result<VenueDetail>>)[],
      onError?: (error: unknown) => boolean,
    ) => {
      setSaving(true);
      let saved: VenueDetail | undefined;
      for (const request of requests) {
        const result = await request();
        if (!result.ok) {
          setSaving(false);
          if (!onError?.(result.error)) hud.show(hudMessage(result.error));
          return;
        }
        saved = result.data;
      }
      if (saved) queryClient.setQueryData(queries.venue(venueId).queryKey, saved);
      void queryClient.invalidateQueries({ queryKey: queries.venues.queryKey });
      setSaving(false);
      router.back();
    },
    [hud, queryClient, venueId],
  );

  return { save, saving };
}
