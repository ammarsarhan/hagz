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

const PitchContext = createContext<PitchContextType | undefined>(undefined);

export function usePitchContext() {
    const context = useContext(PitchContext);

    if (context === undefined) {
        throw new Error("usePitchContext must be initialized with a PitchContext");
    }

    return context;
}

export const PitchContextProvider = ({children} : {children: ReactNode}) => {
    const initialData: PitchType = {
        id: "",
        name: "El Nasr Football Club",
        description: "lorem lorem",
        groundType: "AG",
        pitchSize: "5-A-Side",
        images: [],
        location: {
            street: "4th Nasr Street",
            address: "Smouha",
            governorate: "Alexandria"
        },
        rating: 0,
        amenities: ["Night Lights"],
        activePricingPlan: {
            price: 250,
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
        <PitchContext.Provider value={{
            data: pitchData,
            location: pitchData.location!,
            mode: mode,
            updateData: (fields) => setPitchData({...pitchData, ...fields}),
            updateLocation: (fields) => setPitchData({...pitchData, location: {...pitchData.location, ...fields}} as PitchType),
            setMode: (mode) => setMode(mode)
        }}>
            {children}
        </PitchContext.Provider>
      );
};