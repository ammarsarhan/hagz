import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { AppState } from "react-native";

// Reads are cached until a write here changes them (lib/query.ts), but some of what a screen shows
// changes elsewhere: an invitation sent to this number or taken back, the draft edited on another
// phone. This asks again whenever the screen comes back into view, from a screen pushed over it or
// from the app returning to the foreground. Not on first showing, which has just fetched them.
//
// Pass one array made outside the component: a new one each render would count as the screen coming
// back. Keys are matched as prefixes, so the venue list takes the checklists under it along.
export function useRefreshWhenShown(queryKeys: readonly QueryKey[]) {
  const queryClient = useQueryClient();
  const shown = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const refresh = () => {
        for (const queryKey of queryKeys) void queryClient.invalidateQueries({ queryKey });
      };
      if (shown.current) refresh();
      shown.current = true;
      // Only while this screen is the one in view: nobody is looking at a screen underneath.
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      return () => listener.remove();
    }, [queryClient, queryKeys]),
  );
}
