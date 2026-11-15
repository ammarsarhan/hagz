import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useHud } from "@/components/hud";
import { api } from "./api";
import { hudMessage, send } from "./api-errors";
import { afterVenueWrite, queries } from "./queries";
import { sameTiers, tiersOf, type CancellationPolicy, type CancellationTier } from "./settings";
import type { VenueDetail } from "./venue-edit";

// Choosing a cancellation policy takes up to three screens (pick → your own rules, for Custom only
// → confirm), and nothing is sent until "Save policy" on the last: a half-chosen policy isn't one.
// The screens share this draft, held by their layout (app/setup/[venueId]/settings/cancellation/
// _layout.tsx), so going back keeps what was chosen and leaving drops it.
interface CancellationFlow {
  venueId: string;
  venueName: string;
  policy: CancellationPolicy | null;
  setPolicy: (policy: CancellationPolicy) => void;
  // The owner's own rules, kept while they look at a preset in case they come back to Custom.
  customTiers: CancellationTier[];
  setCustomTiers: (tiers: CancellationTier[]) => void;
  // The rules the chosen policy stands for.
  tiers: CancellationTier[];
  // Whether saving would change anything.
  changed: boolean;
  save: () => Promise<void>;
  saving: boolean;
}

const Context = createContext<CancellationFlow | null>(null);

export const useCancellationFlow = () => {
  const flow = useContext(Context);
  if (!flow) throw new Error("useCancellationFlow outside the cancellation screens");
  return flow;
};

export function CancellationFlowProvider({
  venue,
  venueName,
  finish,
  children,
}: {
  venue: VenueDetail;
  venueName: string;
  // Leaves the screens at once, back to the settings list.
  finish: () => void;
  children: ReactNode;
}) {
  const hud = useHud();
  const queryClient = useQueryClient();
  const saved = venue.settings;
  const [policy, setPolicy] = useState<CancellationPolicy | null>(saved.cancellationPolicy);
  // A first custom policy starts from Moderate's two rules, as in Figma 338:2.
  const [customTiers, setCustomTiers] = useState<CancellationTier[]>(() =>
    saved.cancellationPolicy === "CUSTOM" && saved.cancellationTiers
      ? saved.cancellationTiers
      : tiersOf("MODERATE", null),
  );
  const [saving, setSaving] = useState(false);
  const tiers = policy ? tiersOf(policy, customTiers) : [];
  const changed =
    policy !== saved.cancellationPolicy ||
    (policy === "CUSTOM" && !sameTiers(tiers, saved.cancellationTiers ?? []));

  const save = async () => {
    if (!policy) return;
    setSaving(true);
    const result = await send(
      api.PATCH("/v1/staff/venues/{venueId}/settings", {
        params: { path: { venueId: venue.id } },
        body: {
          cancellationPolicy: policy,
          cancellationTiers: policy === "CUSTOM" ? tiers : null,
        },
      }),
    );
    if (!result.ok) {
      setSaving(false);
      hud.show(hudMessage(result.error));
      return;
    }
    queryClient.setQueryData(queries.venue(venue.id).queryKey, result.data);
    // The checklist ticks the item, and the draft card's "Last updated" moves.
    void afterVenueWrite(queryClient, venue.id);
    finish();
  };

  return (
    <Context.Provider
      value={{
        venueId: venue.id,
        venueName,
        policy,
        setPolicy,
        customTiers,
        setCustomTiers,
        tiers,
        changed,
        save,
        saving,
      }}
    >
      {children}
    </Context.Provider>
  );
}
