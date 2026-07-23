import { useEffect, useRef } from "react";
import { createFormContext } from "@/context/FormContext";
import useDraftQuery from "@/lib/hooks/useDraftQuery";
import { PitchDraftContextType, PitchResponse } from "@/lib/types/pitch";

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
            name: ground.name,
            sport: ground.sport,
            size: ground.size,
            surface: ground.surface,
            basePrice: ground.basePrice,
            description: ground.description ?? undefined,
            peakPrice: ground.peakPrice ?? undefined,
            discountPrice: ground.discountPrice ?? undefined,
            schedule: ground.schedule.map((schedule) => ({
                baseHours: schedule.baseHours,
                peakHours: schedule.peakHours,
                discountHours: schedule.discountHours,
                id: schedule.id,
                status: schedule.status,
                groundId: schedule.groundId,
                dayOfWeek: schedule.dayOfWeek,
                isActive: schedule.isActive,
                lastGeneratedAt: schedule.lastGeneratedAt,
            })),
            settings: ground.settings ?? undefined,
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
    const { setState } = usePitchDraftForm();
    const { draft, query } = useDraftQuery();

    const hydrated = useRef(false);
    const hasRendered = useRef(false);

    useEffect(() => {
        if (hydrated.current) return;
        if (!query.data) return;

        const draft = query.data;
        const state = normalizeDraftData(draft);

        setState((prev) => ({ ...prev, ...state }));
        hydrated.current = true;
    }, [query.data, setState]);

    const isLoading = !hasRendered.current && !!draft && query.isPending;

    useEffect(() => {
        if (!isLoading) hasRendered.current = true;
    });

    if (isLoading) return null;
    return <>{children}</>;
}