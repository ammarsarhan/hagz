import { createFormContext } from "@/context/FormContext";
import { PitchDraftPayload } from "@/lib/types/pitch";

const initial: PitchDraftPayload = { name: "", description: "", taxId: "", areaId: "", street: "", googleMapsLink: "" };
export const { Provider: PitchDraftFormProvider, useFormContext: usePitchDraftForm } = createFormContext<PitchDraftPayload>(initial);
