import PitchType, { DashboardPitchOptionType } from "@/utils/types/pitch";
import { createContext, useState, useContext, ReactNode, useEffect } from "react";

import useAuthContext from "@/context/useAuthContext";

interface DashboardContextDataType {
    activePitchIndex: number,
    pitchOptions: DashboardPitchOptionType[],
    loading: boolean
}

interface DashboardContextActionsType {
    setActivePitchIndex: (index: number) => void,
    setLoading: (loading: boolean) => void
}

interface DashboardContextType {
    data: DashboardContextDataType,
    actions: DashboardContextActionsType
}

export const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export default function useDashboardContext() {
    const context = useContext(DashboardContext);

    if (context === undefined) {
        throw new Error("useDashboardContext must be initialized with a DashboardContext");
    }

    return context;
}

export function DashboardContextProvider({children} : {children: ReactNode}) {
    const auth = useAuthContext();

    const [activePitchIndex, setActivePitchIndex] = useState(0);
    const [pitchOptions, setPitchOptions] = useState<DashboardPitchOptionType[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInitialData = async () => {
            const pitches = await fetch("/api/owner/options", {
                headers: new Headers({
                    "Authorization": `Bearer ${auth.data.accessToken}`
                })
            });
            const data = await pitches.json();

            if (data.pitches) {
                data.pitches.map((pitch: PitchType) => {
                    let option: DashboardPitchOptionType = {
                        id: pitch.id,
                        value: pitch.name,
                        description: `${pitch.location.governorate}, Egypt`,
                        price: pitch.activePricingPlan.price,
                        icon: null,
                    };

                    setPitchOptions(previous => ([...previous, option]));
                })
            }

            setLoading(false);
        }

        fetchInitialData();
    }, [])

    return (
        <DashboardContext.Provider 
            value={{
                data: {
                    activePitchIndex,
                    pitchOptions,
                    loading
                },
                actions: {
                    setActivePitchIndex,
                    setLoading
                }
            }}
        >
            {children}
        </DashboardContext.Provider>
    )
}