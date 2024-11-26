import { createContext, ReactNode, useContext, useState } from "react";
import PitchType from "@/utils/types/pitch";
import AppLocation from "@/utils/types/location";

interface PitchContextType {
    data: Partial<PitchType>,
    location: AppLocation,
    mode: "Create" | "Link" | "Initial",
    updateData: (fields: Partial<PitchType>) => void
    updateLocation: (fields: Partial<AppLocation>) => void
    setMode: (mode: "Create" | "Link" | "Initial") => void
}

const PitchFormContext = createContext<PitchContextType | undefined>(undefined);

export default function usePitchFormContext() {
    const context = useContext(PitchFormContext);

    if (context === undefined) {
        throw new Error("usePitchFormContext must be initialized with a PitchFormContext");
    }

    return context;
}

export const PitchContextFormProvider = ({children} : {children: ReactNode}) => {
    const initialData: PitchType = {
        id: "",
        name: "",
        description: "",
        groundType: "AG",
        pitchSize: "5-A-Side",
        images: [],
        location: {
            street: "",
            address: "",
            governorate: ""
        },
        rating: 0,
        amenities: [],
        activePricingPlan: {
            price: 100,
            deposit: null,
            discount: null,
        },
        pricingPlans: [],
        reservations: [],
        ownerId: ""
    }

    const [pitchData, setPitchData] = useState<Partial<PitchType>>(initialData);
    const [mode, setMode] = useState<"Create" | "Link" | "Initial">("Initial");

    return (
        <PitchFormContext.Provider value={{
            data: pitchData,
            location: pitchData.location!,
            mode: mode,
            updateData: (fields) => setPitchData({...pitchData, ...fields}),
            updateLocation: (fields) => setPitchData({...pitchData, location: {...pitchData.location, ...fields}} as PitchType),
            setMode: (mode) => setMode(mode)
        }}>
            {children}
        </PitchFormContext.Provider>
      );
};