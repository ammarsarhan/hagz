"use client";

import _ from "lodash";
import { useContext, createContext, ReactNode, useState, useEffect, useRef } from "react";
import { toUTCDate, getHourDifference } from "@/utils/date";

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
    error: string | null;
    setError: (message: string | null) => void;
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
    const [error, setError] = useState<string | null>(null);

    const timeout = useRef<NodeJS.Timeout | null>(null);

    const initial = {
        targetDate: "",
        startTime: "",
        endTime: "",
        minimumPrice: 100,
        maximumPrice: 1000,
        searchRadius: 1,
        groundSize: ["5-a-side", "7-a-side", "11-a-side"],
        groundSurface: ["Artificial Grass", "Natural Grass"],
        amenities: []
    } as FilterType;

    const [temp, setTemp] = useState(initial);
    const [data, setData] = useState(initial);

    const [isChanged, setIsChanged] = useState(false);

    useEffect(() => {
        const changed = !_.isEqual(temp, data);
        setIsChanged(changed)
    }, [data, temp]);

    const validateFilterData = () => {
        const now = new Date();
        const { 
            targetDate, 
            startTime, 
            endTime, 
            minimumPrice, 
            maximumPrice, 
            searchRadius,
            groundSize,
            groundSurface
        } = temp;

        if (targetDate != "" && startTime == "" || targetDate != "" && endTime == "") {
            return {
                success: false,
                message: "You may not pick a date without selecting both start and end time.",
                targetIndex: 0
            }
        }

        if (targetDate == "" && startTime != "" || targetDate == "" && endTime != "") {
            return {
                success: false,
                message: "You may not pick a start or end time without selecting a date.",
                targetIndex: 0
            }
        }

        let startDate = toUTCDate(now.toISOString(), "00:00");
        let endDate = toUTCDate(now.toISOString(), "23:59");

        if (startTime != "" || endTime != "") {
            startDate = toUTCDate(targetDate, startTime);
            endDate = toUTCDate(targetDate, endTime);
        };

        if (startDate <= now || endDate <= now) {
            return {
                success: false,
                message: "Both start and end time must be upcoming.",
                targetIndex: 0
            };
        }

        if (startDate >= endDate) {
            return {
                success: false,
                message: "Start time may not be after the end time.",
                targetIndex: 0
            };
        }

        if (getHourDifference(endDate, startDate) < 1 || getHourDifference(endDate, startDate) > 6) {
            return {
                success: false,
                message: "The duration of the booking must be between 1 and 6 hours.",
                targetIndex: 0
            };
        }

        if (minimumPrice >= maximumPrice) {
            return {
                success: false,
                message: "Minimum price may not be greater than or equal to the maximum price.",
                targetIndex: 1
            }
        }

        if (searchRadius < 1 || searchRadius > 10) {
            return {
                success: false,
                message: "Search radius must be between 1 and 10 kilometers.",
                targetIndex: 2
            }
        }

        if (groundSize.length < 1) {
            return {
                success: false,
                message: "You must select at least one option from ground sizes.",
                targetIndex: 3
            }
        }

        if (groundSurface.length < 1) {
            return {
                success: false,
                message: "You must select at least one option from ground surfaces.",
                targetIndex: 3
            }
        }

        return {
            success: true
        }
    }

    const setErrorWithTimeout = (message: string) => {
        setError(message);

        if (timeout.current) {
            clearTimeout(timeout.current);
        }

        timeout.current = setTimeout(() => {
            setError(null);
        }, 3000);
    };

    const saveChanges = () => {
        const parse = validateFilterData();

        if (!parse.success) {
            setSlide(slides[parse.targetIndex!])
            setErrorWithTimeout(parse.message!);
            return;
        }

        setData(temp);
        setOpen(false);
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
            resetChanges,
            error,
            setError
        }}>
            {children}
        </FilterContext.Provider>
    )
}