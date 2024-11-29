"use client";

import { useEffect, useState } from "react";
import { today } from "@/utils/date";

import UtilityBar from "@/components/dashboard/UtilityBar";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import ViewSwitch from "@/components/ui/ViewSwitch";

import DailyView from "@/components/dashboard/DailyView";
import MonthlyView from "@/components/dashboard/MonthlyView";

const reservations = [
    {id: "#2832468249", start: new Date(2024, 9, 11, 0, 0), end: new Date(2024, 9, 11, 2, 0), recurring: false}, 
    {id: "#2832468249", start: new Date(2024, 9, 11, 4, 0), end: new Date(2024, 9, 11, 5, 0), recurring: true}, 
    {id: "#2832468249", start: new Date(2024, 9, 11, 7, 0), end: new Date(2024, 9, 11, 9, 0), recurring: false},
    {id: "#2832468249", start: new Date(2024, 9, 11, 9, 0), end: new Date(2024, 9, 11, 9, 0), recurring: false},
    {id: "#2832468249", start: new Date(2024, 9, 11, 11, 0), end: new Date(2024, 9, 11, 9, 0), recurring: false},
    {id: "#2832468249", start: new Date(2024, 9, 11, 13, 0), end: new Date(2024, 9, 11, 9, 0), recurring: false},
    {id: "#2832468249", start: new Date(2024, 9, 11, 17, 0), end: new Date(2024, 9, 11, 9, 0), recurring: true},
    {id: "#2832468249", start: new Date(2024, 9, 11, 23, 0), end: new Date(2024, 9, 11, 9, 0), recurring: false},
]

export default function Reservations () {
    const [activeDate, setActiveDate] = useState(today);
    const [activeView, setActiveView] = useState(0);
    const [currentReservations, setCurrentReservations] = useState<{id: string, start: Date, end: Date, recurring: boolean}[]>(reservations);

    // Have to be able to open empty calendar cells in case of /dashboard/reservations
    // We want to be able to add a new reservation on empty days
    
    return (
        <>
            <Breadcrumbs labels={[{label: "Reservations", href: "/dashboard/reservations"}]} className="mt-4"/>
            <div className='flex flex-col pt-4'>
                <span className='font-semibold text-xl block'>All</span>
                <div className="mt-2">
                    <ViewSwitch 
                        active={activeView} 
                        onChange={(index) => setActiveView(index)}
                    />
                </div>
                <UtilityBar date={activeDate} variant={activeView} color="slate"/>
            </div>
            {
                activeView === 0 && 
                <DailyView 
                    date={activeDate} 
                    reservations={currentReservations} 
                    color="slate"
                />
            }
            {
                activeView === 1 && 
                <MonthlyView 
                    date={activeDate} 
                    reservations={[1, 5, 7, 11, 13, 14, 16, 18, 19, 24, 27, 30]} 
                    color="slate"
                    onChange={(date) => {setActiveDate(date); setActiveView(0);}}
                />
            }
        </>
    )
}