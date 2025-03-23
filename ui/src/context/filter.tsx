"use client";

import { useContext, createContext, ReactNode, useState } from "react";

export type FilterSlideNameType = "Date" | "Price" | "Location" | "Ground" | "Amenities";
export type GroundSizeFilterType = "5-a-side" | "7-a-side" | "11-a-side";
export type GroundSurfaceFilterType = "Artificial Grass" | "Natural Grass";

export type FilterSlideType = {
    name: FilterSlideNameType,
    component: ReactNode
};

interface FilterContextType {
    slides: FilterSlideType[];
    open: boolean;
    setOpen: (open: boolean) => void;
    slide: FilterSlideType;
    setSlide: (slide: FilterSlideType) => void;
    data: FilterType;
    setData: (data: FilterType) => void;
}

interface FilterType {
    targetDate: string;
    startTime: string;
    endTime: string;
    minimumPrice: number;
    maximumPrice: number;
    searchRadius: number;
    groundSize: GroundSizeFilterType[];
    groundSurface: GroundSurfaceFilterType[];
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function useFilterContext() {
    const context = useContext(FilterContext) as FilterContextType;

    if (!context) {
        throw new Error("useFilterContext must be used within a FilterContextProvider");
    }

    return context;
}

export default function FilterContextProvider({ children, slides }: { children: ReactNode, slides: FilterSlideType[] }) {
    const [open, setOpen] = useState(false);
    const [slide, setSlide] = useState<FilterSlideType>(slides[0]);

    const [data, setData] = useState<FilterType>({
        targetDate: "",
        startTime: "",
        endTime: "",
        minimumPrice: 100,
        maximumPrice: 1000,
        searchRadius: 1,
        groundSize: ["5-a-side", "7-a-side", "11-a-side"],
        groundSurface: ["Artificial Grass", "Natural Grass"]
    });

    return (
        <FilterContext.Provider value={{
            slides,
            open,
            setOpen,
            slide,
            setSlide,
            data,
            setData
        }}>
            {children}
        </FilterContext.Provider>
    )
}