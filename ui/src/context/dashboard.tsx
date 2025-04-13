"use client";

import { createContext, ReactNode, useContext, useState } from "react";
import { useAuthContext } from "@/context/auth";

interface DashboardContextType {
    pitchIndex: number;
    groundIndex: number;
    setPitchIndex: (pitch: number) => void;
    incrementGround: () => void;
    decrementGround: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function useDashboardContext() {
    const context = useContext(DashboardContext) as DashboardContextType;

    if (!context) {
        throw new Error("useDashboardContext must be used within an DashboardContextProvider");
    }

    return context;
}

export default function DashboardContextProvider({ children } : { children: ReactNode }) {
    const { owner } = useAuthContext();

    if (!owner) {
        throw new Error("DashboardContextProvider must be used within an AuthContextProvider with a non-null owner.");
    }

    const [pitchIndex, setPitchIndex] = useState(0);
    const [groundIndex, setGroundIndex] = useState(0);

    const incrementGround = () => {
        if (groundIndex < owner.pitches[pitchIndex].grounds - 1) {
            setGroundIndex(prev => prev + 1);
        }
    }

    const decrementGround = () => {
        if (groundIndex > 0) {
            setGroundIndex(prev => prev - 1);
        }
    }

    return (
        <DashboardContext.Provider value={{ 
            pitchIndex, 
            groundIndex, 
            setPitchIndex, 
            incrementGround, 
            decrementGround 
        }}>
            {children}
        </DashboardContext.Provider>
    )
}
