import { createFormContext } from "@/context/FormContext";
import { PitchDraftPayload } from "@/lib/types/pitch";
import { useEffect, useRef } from "react";
import useDraftQuery from "@/lib/hooks/useDraftQuery";

const initial: PitchDraftPayload = { name: "", description: "", taxId: "", areaId: "", street: "", googleMapsLink: "" };
export const { Provider: PitchDraftFormProvider, useFormContext: usePitchDraftForm } = createFormContext<PitchDraftPayload>(initial);

export function HydratePitchDraft({ children }: { children: React.ReactNode }) {
    const { setState } = usePitchDraftForm();
    const { draft, query } = useDraftQuery();

    const hydrated = useRef(false);

    useEffect(() => {
        if (hydrated.current) return;
        if (!query.data) return;

        const draft = query.data;

        const state = {
            name: draft.name,
            description: draft.description,
            taxId: draft.taxId ?? "",
            street: draft.street,
            areaId: draft.areaId,
            googleMapsLink: draft.googleMapsLink,
        }

        setState((prev) => ({ ...prev, ...state }));
        hydrated.current = true;
    }, [query.data, setState]);

    // No draft exists — nothing to wait for, render immediately.
    if (!draft) return <>{children}</>;

    // Draft exists but hasn't loaded yet, block rendering until hydrated.
    if (query.isPending) return null;

    return <>{children}</>;
}
