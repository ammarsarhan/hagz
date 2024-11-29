import { CalendarDays, Calendar, CalendarPlus, CalendarCog, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

function AddTrigger () {
    const [overlayOpen, setOverlayOpen] = useState(false);

    return (
        <button 
            className="flex items-center gap-2 my-3" onClick={() => setOverlayOpen(!overlayOpen)}>
            <CalendarPlus className="w-4 h-4"/>
            Add
        </button>
    )
}

function ModifyTrigger () {
    const [overlayOpen, setOverlayOpen] = useState(false);

    return (
        <button className="flex items-center gap-2 my-3" onClick={() => setOverlayOpen(!overlayOpen)}>
            <CalendarCog className="w-4 h-4"/>
            Modify
        </button>
    )
}

interface ViewSwitchProps {
    active: number;
    onChange: (index: number) => void;
}

export default function ViewSwitch ({active, onChange} : ViewSwitchProps) {
    const location = usePathname();
    const elements = [
        {label: "Daily", icon: <Calendar className="w-4 h-4"/>}, 
        {label: "Monthly", icon: <CalendarDays className="w-4 h-4"/>}
    ];
    
    return (
        <div className="flex items-center justify-between text-[0.8rem] text-dark-gray border-b-[1px] gap-x-4">
            <div className="hidden sm:flex items-center gap-8">
                {
                    elements.map((el, index) => {
                        if (index === active) {
                            return (
                                <button key={index} className="flex items-center gap-2 my-3 text-blue-700" onClick={() => onChange(index)}>
                                    {el.icon}
                                    {el.label}
                                </button>
                            )
                        }

                        return (
                            <button key={index} className="flex items-center gap-2 my-3" onClick={() => onChange(index)}>
                                {el.icon}
                                {el.label}
                            </button>
                        )
                    })
                }
            </div>
            {
                location === "/dashboard/reservations" && 
                <div className="flex items-center gap-6 sm:gap-8">
                    <AddTrigger/>
                    <ModifyTrigger/>
                </div>
            }
            {
                location === "/dashboard/reservations/scheduled" && 
                <div className="flex items-center gap-6 sm:gap-8">
                    <ModifyTrigger/>
                </div>
            }
        </div>
    )
}