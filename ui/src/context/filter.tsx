"use client";

import { useContext, createContext, ReactNode, useState } from "react";

interface FilterContextType {
    open: boolean;
    setOpen: (open: boolean) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function useFilterContext() {
    const context = useContext(FilterContext) as FilterContextType;

    if (!context) {
        throw new Error("useFilterContext must be used within a FilterContextProvider");
    }

    return context;
}

export default function FilterContextProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);

    return (
        <FilterContext.Provider value={{
            open,
            setOpen,
        }}>
            {children}
        </FilterContext.Provider>
    )
}