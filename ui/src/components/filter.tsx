"use client";

import { FilterSlideType, useFilterContext } from "@/context/filter";
import { SlidersHorizontal, X, DollarSign, Calendar, MapPin, Settings, Notebook } from "lucide-react";
import { ReactNode } from "react";

const FilterSlideToggle = ({ label, icon } : { label: string, icon: ReactNode }) => {
    const { currentSlide, setCurrentSlide } = useFilterContext();

    return (
        <button 
            className={`flex items-center gap-x-[0.375rem] text-sm px-2 py-1 ${currentSlide == label && "border-b-2 border-blue-800! text-blue-800"}`}
            onClick={() => setCurrentSlide(label as FilterSlideType)}
        >
            {icon}
            {label}
        </button>
    )
}

export default function Filter() {
    const { open, currentSlide, setOpen } = useFilterContext();

    if (open) {
        return (
            <div className="fixed top-0 left-0 z-50 h-screen w-screen flex-center bg-black/30">
                <div className="p-6 bg-white rounded-md min-w-96">
                    <div className="flex items-center justify-between pb-3">
                        <span className="flex items-center text-sm gap-x-2"><SlidersHorizontal className="w-4 h-4 text-gray-500"/> Filters</span>
                        <button onClick={() => setOpen(false)}><X className="w-4 h-4"/></button>
                    </div>
                    <div className="px-2 flex items-center justify-between gap-x-8 border-b-[1px]">
                        <FilterSlideToggle label="Date" icon={<Calendar className="w-3 h-3"/>}/>
                        <FilterSlideToggle label="Price" icon={<DollarSign className="w-3 h-3"/>}/>
                        <FilterSlideToggle label="Location" icon={<MapPin className="w-3 h-3"/>}/>
                        <FilterSlideToggle label="Ground" icon={<Settings className="w-3 h-3"/>}/>
                        <FilterSlideToggle label="Amenities" icon={<Notebook className="w-3 h-3"/>}/>
                    </div>
                </div>
            </div>
        );
    }
}
