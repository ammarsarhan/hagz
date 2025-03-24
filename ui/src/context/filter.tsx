"use client";

import _ from "lodash";
import { useContext, createContext, ReactNode, useState, useEffect } from "react";
import { z } from "zod";

export type FilterSlideNameType = "Day" | "Price" | "Location" | "Ground" | "Amenities";
export type GroundSizeFilterType = "5-a-side" | "7-a-side" | "11-a-side";
export type GroundSurfaceFilterType = "Artificial Grass" | "Natural Grass";
export type AmenityFilterType = "Indoors" | "Ball Provided" | "Seating" | "Night Lights" | "Parking" | "Showers" | "Changing Rooms" | "Cafeteria" | "First Aid" | "Security";

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
    temp: FilterType;
    setTemp: (data: FilterType) => void;
    data: FilterType;
    setData: (data: FilterType) => void;
    isChanged: boolean;
    saveChanges: () => void;
    resetChanges: () => void;
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
    amenities: AmenityFilterType[];
}

const toUTCDate = (date: string, time: string) => {
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
};

const filterSchema = z.object({
    targetDate: z.string().default(new Date().toISOString()).refine(date => !isNaN(Date.parse(date)), {
        message: "Invalid date format. Use YYYY-MM-DD.",
    }),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format. Use HH:MM.").default("00:00"),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format. Use HH:MM.").default("23:00"),
    minimumPrice: z.number().min(100, "Minimum price must be non-negative.").max(900, "Minimum price must be 900 EGP at most."),
    maximumPrice: z.number().min(200, "Maximum price must be non-negative.").max(1000, "Minimum price must be 1000 EGP at most."),
    searchRadius: z.number().min(1, "Search radius must be at least 1.").max(10, "Search radius must be 10 at most."),
    groundSize: z.array(z.enum(["5-a-side", "7-a-side", "11-a-side"] as const)).min(1, { message: "At least one ground size option must be selected." }),
    groundSurface: z.array(z.enum(["Artificial Grass", "Natural Grass"] as const)).min(1, { message: "At least one ground surface option must be selected." }),
    amenities: z.array(z.enum([
        "Indoors", "Ball Provided", "Seating", "Night Lights", "Parking",
        "Showers", "Changing Rooms", "Cafeteria", "First Aid", "Security"
    ] as const)),
}).refine(data => {
    const start = toUTCDate(data.targetDate, data.startTime);
    const end = toUTCDate(data.targetDate, data.endTime);
    return start < end;
}, {
    message: "End time must be after start time.",
    path: ["endTime"],
});

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

    const initial = {
        targetDate: "",
        startTime: "",
        endTime: "",
        minimumPrice: 100,
        maximumPrice: 1000,
        searchRadius: 1,
        groundSize: ["5-a-side", "7-a-side", "11-a-side"],
        groundSurface: ["Artificial Grass", "Natural Grass"],
        amenities: ["Indoors"]
    } as FilterType;

    const [temp, setTemp] = useState(initial);
    const [data, setData] = useState(initial);

    const [isChanged, setIsChanged] = useState(false);

    useEffect(() => {
        const changed = !_.isEqual(temp, data);
        setIsChanged(changed)
    }, [data, temp]);

    const saveChanges = () => {
        setData(temp);
    }
    
    const resetChanges = () => {
        setTemp(initial);
        setData(initial);
    }

    return (
        <FilterContext.Provider value={{
            slides,
            open,
            setOpen,
            slide,
            setSlide,
            temp,
            setTemp,
            data,
            setData,
            isChanged,
            saveChanges,
            resetChanges
        }}>
            {children}
        </FilterContext.Provider>
    )
}