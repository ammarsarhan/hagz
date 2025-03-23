"use client";

import { useContext, createContext, ReactNode, useState } from "react";

export type FilterSlideType = "Date" | "Price" | "Location" | "Ground" | "Amenities";

interface FilterContextType {
    open: boolean;
    setOpen: (open: boolean) => void;
    currentSlide: FilterSlideType;
    setCurrentSlide: (slide: FilterSlideType) => void;
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
    const [currentSlide, setCurrentSlide] = useState<FilterSlideType>("Date");

    return (
        <FilterContext.Provider value={{
            open,
            setOpen,
            currentSlide,
            setCurrentSlide
        }}>
            {children}
        </FilterContext.Provider>
    )
}