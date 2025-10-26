"use client";

import { DateScopeType, ViewType } from '@/app/utils/types/booking';
import React, { createContext, ReactNode, useContext, useState } from 'react';

export interface TargetOption {
    name: string;
    id: string;
    type: "ALL" | "GROUND" | "COMBINATION"
};

interface DataLayoutType {
    grounds: Array<{
        name: string;
        id: string;
        combinations: Array<{
            id: string;
            name: string;
        }>
    }>;
};

const parseTargets = (data: DataLayoutType): TargetOption[] => {
    if (!data.grounds.length) return [];

    const seenCombinations = new Set<string>();
    const groundOptions: TargetOption[] = [];
    const combinationOptions: TargetOption[] = [];

    for (const ground of data.grounds) {
        // Add each ground
        groundOptions.push({
            name: ground.name,
            type: "GROUND",
            id: ground.id,
        });

        // Collect unique combinations
        for (const combo of ground.combinations) {
            if (!seenCombinations.has(combo.id)) {
                seenCombinations.add(combo.id);
                combinationOptions.push({
                    name: `${combo.name}`,
                    type: "COMBINATION",
                    id: combo.id,
                });
            }
        }
    }

    return [
        { name: `All Grounds (${groundOptions.length})`, id: "ALL", type: "ALL" },
        ...groundOptions,
        ...combinationOptions,
    ];
};

interface BookingContextType {
    viewType: ViewType,
    setViewType: (value: ViewType) => void,
    dateScope: DateScopeType,
    setDateScope: (value: DateScopeType) => void,
    activeTarget: TargetOption,
    setActiveTarget: (value: TargetOption) => void,
    targets: TargetOption[]
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export default function useBookingContext() {
    const context = useContext(BookingContext);

    if (!context) {
        throw new Error("useBookingContext must be used within a BookingProvider");
    }

    return context;
}

interface BookingContextProviderProps {
    children: ReactNode,
    layout: DataLayoutType
}

export function BookingContextProvider({ children, layout } : BookingContextProviderProps) {
    const targets = parseTargets(layout);

    const [viewType, setViewType] = useState<ViewType>("LIST");
    const [dateScope, setDateScope] = useState<DateScopeType>("TODAY");
    const [activeTarget, setActiveTarget] = useState<TargetOption>(targets[0]);

    const value = {
        viewType,
        setViewType,
        dateScope,
        setDateScope,
        activeTarget,
        setActiveTarget,
        targets
    };

    return (
        <BookingContext.Provider value={value}>
            {children}
        </BookingContext.Provider>
    )
};