"use client";

import { ReactNode } from "react";
import { useFilterContext } from "@/context/filter";
import Button from "@/components/button";
import { SlidersHorizontal, X, DollarSign, Calendar, MapPin, Settings, Notebook } from "lucide-react";

const FilterSlideToggle = ({ label, icon, index } : { label: string, icon: ReactNode, index: number }) => {
    const { slides, slide, setSlide } = useFilterContext();

    return (
        <button 
            className={`flex items-center gap-x-[0.375rem] text-sm px-2 py-1 ${slide.name == label && "border-b-2 border-blue-800! text-blue-800"}`}
            onClick={() => setSlide(slides[index])}
        >
            {icon}
            {label}
        </button>
    )
}

export default function Filter() {
    const { open, slide, setOpen, isChanged, saveChanges, resetChanges } = useFilterContext();

    const toggles = [
        {
            label: "Day",
            icon: <Calendar className="w-4 h-4 text-gray-500"/>
        },
        {
            label: "Price",
            icon: <DollarSign className="w-4 h-4 text-gray-500"/>
        },
        {
            label: "Location",
            icon: <MapPin className="w-4 h-4 text-gray-500"/>
        },
        {
            label: "Ground",
            icon: <Settings className="w-4 h-4 text-gray-500"/>
        },
        {
            label: "Amenities",
            icon: <Notebook className="w-4 h-4 text-gray-500"/>
        }
    ]

    const handleCloseModal = () => {
        if (isChanged) {
            resetChanges();
        }

        setOpen(false);
    };

    if (open) {
        return (
            <div className="fixed top-0 left-0 z-50 h-screen w-screen flex-center bg-black/30">
                <div className="p-6 bg-white rounded-md min-w-96 w-2xl mx-4">
                    <div className="flex items-center justify-between pb-3">
                        <span className="flex items-center text-sm gap-x-2"><SlidersHorizontal className="w-4 h-4 text-gray-500"/> Filters</span>
                        <button onClick={handleCloseModal}><X className="w-4 h-4"/></button>
                    </div>
                    <div className="px-2 flex items-center justify-between gap-x-8 border-b-[1px]">
                        {   
                            toggles.map((toggle, index) => (
                                <FilterSlideToggle label={toggle.label} icon={toggle.icon} index={index} key={index}/>
                            ))
                        }
                    </div>
                    <div className="py-4">
                        {slide.component}
                    </div>
                    <div className="border-t-[1px] pt-4 flex items-center justify-between">   
                        <button 
                            className={`text-sm ${isChanged ? "text-blue-800 hover:underline" : "text-gray-500 cursor-auto!"}`} 
                            disabled={!isChanged} 
                            onClick={resetChanges}
                        >
                            Reset
                        </button>
                        <Button 
                            className="text-xs"
                            variant={isChanged ? "primary" : "disabled"} 
                            disabled={!isChanged} 
                            onClick={saveChanges}
                        >
                            Save Changes
                        </Button>
                    </div>
                </div>
            </div>
        );
    }
}
