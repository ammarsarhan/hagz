import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useHud } from "@/components/hud";
import { api } from "./api";
import { hudMessage, send, type Result } from "./api-errors";
import type { Ground, GroundEnvironment, GroundSize, GroundSport, GroundSurface } from "./grounds";
import { minorOf } from "./money";
import { queries } from "./queries";

// Adding or editing a ground takes four screens (name, sport and size → surface and cover → prices
// → booking length), and nothing is sent until the last one: a half-made ground would show up in
// the list, and the API needs its prices to create it. The four screens share this draft, held by
// their layout (app/setup/[venueId]/grounds/[groundId]/_layout.tsx) so going back keeps what was
// chosen and leaving drops it.
export interface GroundDraft {
  name: string;
  sport: GroundSport;
  size: GroundSize;
  surface: GroundSurface;
  environment: GroundEnvironment;
  // As typed, in major units ("700"): turned into minor units when it's sent.
  basePrice: string;
  peakPrice: string;
  discountPrice: string;
  minimumSlots: number;
  maximumSlots: number;
}

interface GroundFlow {
  venueId: string;
  // The ground being edited; null while adding one.
  ground: Ground | null;
  currency: string;
  decimals: number;
  draft: GroundDraft;
  update: (change: Partial<GroundDraft>) => void;
  // Editing: whether the draft differs from the ground, which is all Save sends. Always true while
  // adding one.
  changed: boolean;
  save: () => Promise<void>;
  saving: boolean;
}

const Context = createContext<GroundFlow | null>(null);

export const useGroundFlow = () => {
  const flow = useContext(Context);
  if (!flow) throw new Error("useGroundFlow outside a ground's screens");
  return flow;
};

export function GroundFlowProvider({
  venueId,
  ground,
  initial,
  currency,
  decimals,
  finish,
  children,
}: {
  venueId: string;
  ground: Ground | null;
  initial: GroundDraft;
  currency: string;
  decimals: number;
  // Leaves the four screens at once, back to the list.
  finish: () => void;
  children: ReactNode;
}) {
  const hud = useHud();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);

  const update = useCallback(
    (change: Partial<GroundDraft>) => setDraft((current) => ({ ...current, ...change })),
    [],
  );

  // Done: everything under the venue is refetched, so the list, the checklist's tick and the draft
  // card's "Last updated" all follow.
  const settle = useCallback(
    async (result: Result<unknown>) => {
      if (!result.ok) {
        hud.show(hudMessage(result.error));
        return false;
      }
      await queryClient.invalidateQueries({ queryKey: queries.venues.queryKey });
      finish();
      return true;
    },
    [finish, hud, queryClient],
  );

  const optional = (amount: string) => {
    const minor = minorOf(amount, decimals);
    return Number.isNaN(minor) ? null : minor;
  };
  const fields = {
    name: draft.name.trim(),
    sport: draft.sport,
    size: draft.size,
    surface: draft.surface,
    environment: draft.environment,
    basePrice: minorOf(draft.basePrice, decimals),
    peakPrice: optional(draft.peakPrice),
    discountPrice: optional(draft.discountPrice),
    minimumSlots: draft.minimumSlots,
    maximumSlots: draft.maximumSlots,
  };
  // Editing sends only what changed (the API checks the result as a whole).
  const change = ground
    ? Object.fromEntries(
        Object.entries(fields).filter(
          ([key, value]) => (ground as unknown as Record<string, unknown>)[key] !== value,
        ),
      )
    : null;
  const changed = change === null || Object.keys(change).length > 0;

  const save = async () => {
    setSaving(true);
    const result = ground
      ? await send(
          api.PATCH("/v1/staff/venues/{venueId}/grounds/{groundId}", {
            params: { path: { venueId, groundId: ground.id } },
            body: change ?? {},
          }),
        )
      : await send(
          api.POST("/v1/staff/venues/{venueId}/grounds", {
            params: { path: { venueId } },
            body: fields,
          }),
        );
    if (!(await settle(result))) setSaving(false);
  };

  return (
    <Context.Provider
      value={{ venueId, ground, currency, decimals, draft, update, changed, save, saving }}
    >
      {children}
    </Context.Provider>
  );
}
