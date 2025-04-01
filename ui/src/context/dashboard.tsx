"use client";

import { createContext, ReactNode, useContext, useState } from "react";

interface DashboardContextType {
    pitch: number;
    ground: number;
    setPitch: (pitch: number) => void;
    setGround: (ground: number) => void;
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
    const [pitch, setPitch] = useState(0);
    const [ground, setGround] = useState(0);

    return (
        <DashboardContext.Provider value={{ pitch, ground, setPitch, setGround }}>
            {children}
        </DashboardContext.Provider>
    )
}
