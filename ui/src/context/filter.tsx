"use client";

import _ from "lodash";
import { useContext, createContext, ReactNode, useState, useEffect, useRef } from "react";

import { toUTCDate, getHourDifference, getDay } from "@/utils/date";
import { getKeyFromValue } from "@/utils/map";
import { getClientLocation } from "@/utils/location";

export type GroundStatusDisplayType = "Active" | "Maintenance" | "Closed";
export type FilterSlideNameType = "Day" | "Price" | "Location" | "Ground" | "Amenities";
export type GroundSizeFilterType = "5-a-side" | "7-a-side" | "11-a-side";
export type GroundSurfaceFilterType = "Artificial Grass" | "Natural Grass";
export type AmenityFilterType = "Indoors" | "Ball Provided" | "Seating" | "Night Lights" | "Parking" | "Showers" | "Changing Rooms" | "Cafeteria" | "First Aid" | "Security";

export type GroundStatusType = "ACTIVE" | "MAINTENANCE" | "CLOSED";
export type GroundSizeType = "FIVE_A_SIDE" | "SEVEN_A_SIDE" | "ELEVEN_A_SIDE";
export type GroundSurfaceType = "ARTIFICIAL" | "NATURAL";
export type AmenityType = "INDOORS" | "BALL_PROVIDED" | "SEATING" | "NIGHT_LIGHTS" | "PARKING" | "SHOWERS" | "CHANGING_ROOMS" | "CAFETERIA" | "FIRST_AID" | "SECURITY";

interface FilterContextType {
    open: boolean;
    setOpen: (open: boolean) => void;
    temp: FilterType;
    setTemp: (data: FilterType) => void;
    options: DataFilterType;
    setOptions: (data: DataFilterType) => void;
    isChanged: boolean;
    error: string | null;
    setError: (message: string | null) => void;
    loading: boolean;
    save: () => void;
    reset: () => void;
}

interface FilterType {
    targetDate: string;
    startTime: string;
    endTime: string;
    minimumPrice: number;
    maximumPrice: number;
    searchRadius: number | null;
    groundSize: GroundSizeFilterType[];
    groundSurface: GroundSurfaceFilterType[];
    amenities: AmenityFilterType[];
}

export interface DataFilterType {
    startDate: string;
    endDate: string;
    minimumPrice: number;
    maximumPrice: number;
    location: {
        longitude: number | null;
        latitude: number | null;
    };
    radius: number | null;
    size: GroundSizeType[];
    surface: GroundSurfaceType[];
    amenities: AmenityType[];
}

export const sizeMap = new Map<GroundSizeFilterType, GroundSizeType>([
    ["5-a-side", "FIVE_A_SIDE"],
    ["7-a-side", "SEVEN_A_SIDE"],
    ["11-a-side", "ELEVEN_A_SIDE"]
]);

export const surfaceMap = new Map<GroundSurfaceFilterType, GroundSurfaceType>([
    ["Artificial Grass", "ARTIFICIAL"],
    ["Natural Grass", "NATURAL"]
]);

export const statusMap = new Map<GroundStatusDisplayType, GroundStatusType>([
    ["Active", "ACTIVE"],
    ["Maintenance", "MAINTENANCE"],
    ["Closed", "CLOSED"]
]);

export const amenityMap = new Map<AmenityFilterType, AmenityType>([
    ["Indoors", "INDOORS"],
    ["Ball Provided", "BALL_PROVIDED"],
    ["Seating", "SEATING"],
    ["Night Lights", "NIGHT_LIGHTS"],
    ["Parking", "PARKING"],
    ["Showers", "SHOWERS"],
    ["Changing Rooms", "CHANGING_ROOMS"],
    ["Cafeteria", "CAFETERIA"],
    ["First Aid", "FIRST_AID"],
    ["Security", "SECURITY"]
]);

export function buildQueryUrl (filters: DataFilterType) {
    const { startDate, endDate, minimumPrice, maximumPrice, location, radius, size, surface, amenities } = filters;
    let url = `http://localhost:3000/api/pitch?limit=10&startDate=${startDate}&endDate=${endDate}&min=${minimumPrice}&max=${maximumPrice}`;
    
    if (location.longitude && location.latitude && radius) {
        url += `&longitude=${location.longitude}&latitude=${location.latitude}&radius=${radius}`;
    }

    size.forEach(item => url += `&size=${item}`);
    surface.forEach(item => url += `&surface=${item}`);
    amenities.forEach(item => url += `&amenities=${item}`);

    return url;
}

const parseFilters = (filter: FilterType): DataFilterType => {
    const { minimumPrice, maximumPrice, searchRadius, groundSize, groundSurface, amenities } = filter;
    let { targetDate, startTime, endTime } = filter;

    targetDate = targetDate == "" ? new Date().toISOString() : targetDate;
    startTime = startTime == "" ? "00:00" : startTime;
    endTime = endTime == "" ? "23:59" : endTime;

    targetDate = getDay(new Date(targetDate));

    const startDate = toUTCDate(targetDate, startTime).toISOString();
    const endDate = toUTCDate(targetDate, endTime).toISOString();

    const size = groundSize.map(size => sizeMap.get(size)!);
    const surface = groundSurface.map(surface => surfaceMap.get(surface)!);
    const pitchAmenities = amenities.map(amenity => amenityMap.get(amenity)!);

    return {
        startDate,
        endDate,
        minimumPrice,
        maximumPrice,
        location: {
            longitude: null,
            latitude: null
        },
        radius: searchRadius || null,
        size,
        surface,
        amenities: pitchAmenities
    };
}

const getFilterFromData = (data: DataFilterType): FilterType => {
    const { startDate, endDate, minimumPrice, maximumPrice, radius, size, surface, amenities } = data;

    const now = new Date().toISOString().split("T")[0];
    let targetDate = new Date(startDate).toISOString().split("T")[0];

    let startTime = new Date(startDate).toISOString().split("T")[1];
    let endTime = new Date(endDate).toISOString().split("T")[1]; 

    startTime = startTime.split(":")[0] + ":" + startTime.split(":")[1];
    endTime = endTime.split(":")[0] + ":" + endTime.split(":")[1];
    
    if (startTime == "00:00" && endTime == "23:59" && targetDate == now) {
        startTime = "";
        endTime = "";
        targetDate = "";
    }
    
    const groundSize = size.map(el => getKeyFromValue<GroundSizeType, GroundSizeFilterType>(sizeMap, el)!);
    const groundSurface = surface.map(el => getKeyFromValue<GroundSurfaceType, GroundSurfaceFilterType>(surfaceMap, el)!);
    const pitchAmenities = amenities.map(el => getKeyFromValue<AmenityType, AmenityFilterType>(amenityMap, el)!);

    return {
        targetDate,
        startTime,
        endTime,
        minimumPrice,
        maximumPrice,
        searchRadius: radius,
        groundSize,
        groundSurface,
        amenities: pitchAmenities
    };
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const timeout = useRef<NodeJS.Timeout | null>(null);

    const initial = {
        targetDate: "",
        startTime: "",
        endTime: "",
        minimumPrice: 100,
        maximumPrice: 1000,
        searchRadius: null,
        groundSize: ["5-a-side", "7-a-side", "11-a-side"],
        groundSurface: ["Artificial Grass", "Natural Grass"],
        amenities: []
    } as FilterType;

    const [temp, setTemp] = useState(initial);
    const [options, setOptions] = useState(parseFilters(initial));

    const [isChanged, setIsChanged] = useState(false);

    useEffect(() => {
        const comparator = getFilterFromData(options);
        const changed = !_.isEqual(temp, comparator);
        setIsChanged(changed)
    }, [options, temp]);

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
                message: "Start time may not be after the end time."
            };
        }

        if (getHourDifference(endDate, startDate) < 1 || getHourDifference(endDate, startDate) > 6) {
            return {
                success: false,
                message: "The duration of the booking must be between 1 and 6 hours."
            };
        }

        if (minimumPrice < 100 || maximumPrice > 1000) {
            return {
                success: false,
                message: "Price range must be between 100 and 1000 EGP."
            }
        }

        if (minimumPrice >= maximumPrice) {
            return {
                success: false,
                message: "Minimum price may not be greater than or equal to the maximum price."
            }
        }

        if (searchRadius && (searchRadius < 1 || searchRadius > 10)) {
            return {
                success: false,
                message: "Search radius must either be between 1 and 10 kilometers."
            }
        }

        if (groundSize.length < 1) {
            return {
                success: false,
                message: "You must select at least one option from ground sizes."
            }
        }

        if (groundSurface.length < 1) {
            return {
                success: false,
                message: "You must select at least one option from ground surfaces."
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

    const save = async () => {
        setLoading(true);
        const parse = validateFilterData();

        if (!parse.success) {
            setErrorWithTimeout(parse.message!);
            setLoading(false);
            return;
        }

        let location : {
            latitude: number | null,
            longitude: number | null
        } = {
            latitude: null,
            longitude: null
        };

        if (temp.searchRadius != null) {
            const request = await getClientLocation() as { latitude: number, longitude: number, error: string | null };

            if (request.error) {
                setErrorWithTimeout(request.error);
                return;
            }

            location = { longitude: request.longitude, latitude: request.latitude };
        }
        
        const parsed = parseFilters(temp);
        parsed.location = location;

        setOptions(parsed);
        setOpen(false);
        setLoading(false);
    }
    
    const reset = () => {
        setTemp(initial);
        setOptions(parseFilters(initial));
        setOpen(false);
    }

    return (
        <FilterContext.Provider value={{
            open,
            setOpen,
            temp,
            setTemp,
            options,
            setOptions,
            isChanged,
            error,
            setError,
            loading,
            save,
            reset,
        }}>
            {children}
        </FilterContext.Provider>
    )
}