import { useEffect, useRef } from "react";
import { createFormContext } from "@/context/FormContext";
import useDraftQuery from "@/lib/hooks/useDraftQuery";
import { PitchDraftContextType, PitchResponse } from "@/lib/types/pitch";
import { buildScheduleDraft } from "@/lib/types/ground";

const initial: PitchDraftContextType = { name: "", description: "", taxId: "", areaId: "", street: "", googleMapsLink: "", media: [], amenities: [], grounds: [] };
export const { Provider: PitchDraftFormProvider, useFormContext: usePitchDraftForm } = createFormContext<PitchDraftContextType>(initial);

type PitchData = PitchResponse['data']['pitch'];

const normalizeDraftData = (pitch: PitchData) => {
    const normalizeMedia = (media: (typeof pitch)['media']) => {
        return media.map(item => ({
            ...item,
            state: "UPLOADED" as const
        }));
    };

    const normalizeAmenities = (amenities: (typeof pitch)['amenities']) => {
        return amenities.map(item => {
            const { pitchId, description, price, unit, ...data } = item;

            return {
                ...data,
                description: description ?? undefined,
                price: price ?? undefined,
                unit: unit ?? undefined,
            };
        });
    };

    const normalizeGrounds = (grounds: (typeof pitch)['grounds']) => {
        return grounds.map((ground) => ({
            id: ground.id,
            name: ground.name,
            sport: ground.sport,
            size: ground.size,
            surface: ground.surface,
            basePrice: ground.basePrice,
            description: ground.description ?? undefined,
            peakPrice: ground.peakPrice ?? undefined,
            discountPrice: ground.discountPrice ?? undefined,
            schedule: buildScheduleDraft(ground.schedule),
        }));
    }

    const state = {
        name: pitch.name,
        description: pitch.description,
        taxId: pitch.taxId ?? "",
        street: pitch.street,
        areaId: pitch.areaId,
        googleMapsLink: pitch.googleMapsLink,
        media: normalizeMedia(pitch.media),
        amenities: normalizeAmenities(pitch.amenities),
        grounds: normalizeGrounds(pitch.grounds)
    };

    return state;
};

export function HydratePitchDraft({ children }: { children: React.ReactNode }) {
    const { state, setState } = usePitchDraftForm();
    const { draft, query } = useDraftQuery();

    const hydrated = useRef(false);
    const hasRendered = useRef(false);

    useEffect(() => {
        // Prevent re‑hydration after local edits. If we already have any
        // persisted data (e.g., amenities or media) in the form state, skip
        // overwriting it with the draft fetched from the server.
        if (hydrated.current) return;
        if (!query.data) return;
        
        // If the local form already contains user‑entered data, do not
        // hydrate again (this can happen when the component unmounts/remounts
        // during the onboarding flow).
        const localState = state;
        if (localState.amenities.length > 0 || localState.media.length > 0) return;

        const draft = query.data;
        const newState = normalizeDraftData(draft);
        setState((prev) => ({ ...prev, ...newState }));
        hydrated.current = true;
    }, [query.data, setState, state]);

    const isLoading = !hasRendered.current && !!draft && query.isPending;

    useEffect(() => {
        if (!isLoading) hasRendered.current = true;
    });

    if (isLoading) return null;
    return <>{children}</>;
}