"use client";

import React, { createContext, ReactNode, useContext, useState } from 'react';

import { DateScopeType, ViewType } from '@/app/utils/types/booking';
import { PitchScheduleItem, PitchSettings, ResolvedSettings } from "@/app/utils/types/pitch";

export interface TargetOption {
    name: string;
    id: string;
    type: "ALL" | "GROUND" | "COMBINATION"
};

export interface BookingTargetOption {
    name: string;
    id: string;
    type: "GROUND" | "COMBINATION";
    settings: ResolvedSettings
};

interface BookingContextType {
    view: ViewType,
    setView: (value: ViewType) => void,
    scope: DateScopeType,
    setScope: (value: DateScopeType) => void,
    target: TargetOption,
    setTarget: (value: TargetOption) => void,
    targets: TargetOption[],
    schedule: Array<PitchScheduleItem>,
    settings: PitchSettings
};

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export default function useBookingContext() {
    const context = useContext(BookingContext);

    if (!context) {
        throw new Error("useBookingContext must be used within a BookingProvider");
    }

    return context;
};

interface BookingContextProviderProps {
    children: ReactNode,
    targets: TargetOption[],
    schedule: Array<PitchScheduleItem>,
    settings: PitchSettings
};

const listOptions = [
    "TODAY", "TOMORROW", "WEEK", "NEXT_WEEK", "MONTH", "UPCOMING", "PAST_WEEK", "PAST_MONTH", "ALL"
];
const weeklyOptions = [
    "WEEK", "NEXT_WEEK", "PAST_WEEK"
];

export function BookingContextProvider({ children, targets, schedule, settings } : BookingContextProviderProps) {
    const [view, setView] = useState<ViewType>("WEEKLY");
    const [scope, setScope] = useState<DateScopeType>("WEEK");
    const [target, setTarget] = useState<TargetOption>(targets[0]);

    const handleSetViewType = (view: ViewType) => {
        const isList = view === "LIST";
        const options = isList ? listOptions : weeklyOptions;

        if (!options.includes(scope)) {
            setScope(isList ? "TODAY" : "WEEK");
        };

        setView(view);
    };

    const value = {
        view,
        setView: handleSetViewType,
        scope,
        setScope,
        target,
        setTarget,
        targets,
        schedule,
        settings
    };

    return (
        <BookingContext.Provider value={value}>
            {children}
        </BookingContext.Provider>
    )
};