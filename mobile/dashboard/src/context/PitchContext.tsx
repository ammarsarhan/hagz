import { client } from "@/lib/client";
import { getActivePitch, saveActivePitch } from "@/lib/storage";
import { InferResponseType } from "hono/client";
import { useQuery } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useRequiredAuth } from "@/context/AuthContext";

type DashboardPitchesRequest = typeof client.dashboard.pitches;
export type DashboardPitchesResponse = InferResponseType<DashboardPitchesRequest["$get"]>;
export type Pitch = DashboardPitchesResponse["data"]["pitches"][number];

type PitchContextType =
    | { isLoading: true; pitches: Pitch[]; pitch: null; setPitch: (pitchId: string) => void }
    | { isLoading: false; pitches: Pitch[]; pitch: Pitch; setPitch: (pitchId: string) => void };

const PitchContext = createContext<PitchContextType | null>(null);

async function fetchDashboardPitches(): Promise<Pitch[]> {
    const res = await client.dashboard.pitches.$get();
    if (!res.ok) throw new Error("Failed to fetch dashboard pitches.");

    const { data } = await res.json();
    return data.pitches;
}

export function PitchProvider({ children }: { children: ReactNode }) {
    const { user } = useRequiredAuth();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isStorageReady, setIsStorageReady] = useState(false);

    // Load the persisted selection once on mount.
    useEffect(() => {
        getActivePitch()
            .then(setActiveId)
            .finally(() => setIsStorageReady(true));
    }, []);

    const { data: pitches, isLoading: isPitchesLoading } = useQuery({
        queryKey: ["dashboard"],
        queryFn: fetchDashboardPitches,
        enabled: !!user,
        staleTime: 1000 * 60 * 5,
    });

    const pitch = useMemo(() => {
        if (!pitches || pitches.length === 0) return null;
        return pitches.find((p) => p.id === activeId) ?? pitches[0];
    }, [pitches, activeId]);

    // In case of any changes that make the current pitch no longer the active pitch, reconcile.
    useEffect(() => {
        if (pitch && pitch.id !== activeId) {
            setActiveId(pitch.id);
            saveActivePitch(pitch.id).catch((e) =>
                console.error("Failed to persist active pitch:", e)
            );
        }
    }, [pitch, activeId]);

    const setPitch = (pitchId: string) => {
        setActiveId(pitchId);
        saveActivePitch(pitchId).catch((e) =>
            console.error("Failed to persist active pitch:", e)
        );
    };

    const isLoading = isPitchesLoading || !isStorageReady;

    const value: PitchContextType = isLoading || !pitch
        ? { isLoading: true, pitches: pitches ?? [], pitch: null, setPitch }
        : { isLoading: false, pitches: pitches!, pitch, setPitch };

    return <PitchContext.Provider value={value}>{children}</PitchContext.Provider>;
}

export function usePitch() {
    const ctx = useContext(PitchContext);
    if (!ctx) throw new Error("usePitch must be used within a <PitchProvider>.");
    return ctx;
};

export function useRequiredPitch() {
    const ctx = usePitch();

    if (ctx.isLoading) {
        throw new Error(
            "useRequiredPitch() was called before the active pitch was loaded."
        );
    }

    return ctx;
}
