import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import type { components } from "@hagz/api";
import { useHud } from "@/components/hud";
import { api } from "./api";
import { hudMessage, send, type Result } from "./api-errors";
import { afterVenueWrite, queries } from "./queries";

export type VenueDetail = components["schemas"]["StaffVenueDetail"];

// Saving a setup item's screen: send its requests one after another, put the venue each answers with
// in the cache, then go back to the checklist. The checklist and the venue list are refetched after,
// so the item ticks and the draft card's "2m ago" moves; the venue itself isn't, it's the answer.
//
// A failure stops there and is handed back, for the screen to put under its field when it's the
// person's to fix; anything else goes to the HUD.
//
// `refresh`, for a save that changes another read: `also` is refetched with the checklist, `drop`
// is thrown away, for a read whose cached answer would now be wrong to start from (it loads afresh
// next time it's shown).
export function useSaveVenue(venueId: string) {
  const queryClient = useQueryClient();
  const hud = useHud();
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (
      requests: (() => Promise<Result<VenueDetail>>)[],
      onError?: (error: unknown) => boolean,
      refresh: { also?: QueryKey[]; drop?: QueryKey[] } = {},
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
      for (const queryKey of refresh.drop ?? [])
        queryClient.removeQueries({ queryKey, exact: true });
      void afterVenueWrite(queryClient, venueId, { also: refresh.also });
      setSaving(false);
      router.back();
    },
    [hud, queryClient, venueId],
  );

  return { save, saving };
}

type SettingsChange = components["schemas"]["UpdateVenueSettings"];

// Saving one of the venue's settings as soon as it's changed (the "Payments and cancellations"
// list has no Save button). The change shows at once and is sent behind it; if the API refuses
// it, the venue goes back to how it was and the HUD says why. Resolves to whether it saved.
export function useSaveSettings(venueId: string) {
  const queryClient = useQueryClient();
  const hud = useHud();

  return useCallback(
    async (change: SettingsChange) => {
      const key = queries.venue(venueId).queryKey;
      const before = queryClient.getQueryData<VenueDetail>(key);
      if (before) {
        queryClient.setQueryData<VenueDetail>(key, {
          ...before,
          settings: { ...before.settings, ...change },
        });
      }
      const result = await send(
        api.PATCH("/v1/staff/venues/{venueId}/settings", {
          params: { path: { venueId } },
          body: change,
        }),
      );
      if (!result.ok) {
        if (before) queryClient.setQueryData(key, before);
        hud.show(hudMessage(result.error));
        return false;
      }
      queryClient.setQueryData(key, result.data);
      // The draft card's "Last updated" follows, and the checklist: no setting here finishes an item
      // (the policy, which does, is saved by the cancellation flow), but any of them counts as
      // changing Settings when a review sent the venue back asking to.
      void afterVenueWrite(queryClient, venueId);
      return true;
    },
    [hud, queryClient, venueId],
  );
}
