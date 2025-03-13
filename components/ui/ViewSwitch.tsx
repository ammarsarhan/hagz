import useReservationContext from "@/context/useReservationContext";
import Skeleton from "react-loading-skeleton";
import Link from "next/link";
import { CalendarDays, Calendar, CalendarPlus, X, Notebook } from "lucide-react";

export default function ViewSwitch () {
    const context = useReservationContext();

    const loading = context.data.loading;
    const active = context.data.currentView;
    
    const switchView = () => {
        if (active == "List") {
            context.actions.setCurrentView("Calendar");
        } else {
            context.actions.setCurrentView("List");
        }
    }

    const elements = [
        {label: "List", icon: <Calendar className="w-4 h-4"/>}, 
        {label: "Calendar", icon: <CalendarDays className="w-4 h-4"/>}
    ];
    
    return (
        <div className="flex items-center justify-between text-[0.8rem] text-dark-gray border-b-[1px] gap-x-4">
            <div className="hidden sm:flex items-center gap-6">
                {
                    elements.map((el, index) => {
                        if (loading) {
                            return (
                                <Skeleton key={index} width={50} height={20} className="my-3"/>
                            )
                        }

                        if (active == el.label) {
                            return (
                                <button key={index} className="flex items-center gap-2 my-3 text-blue-700">
                                    {el.icon}
                                    {el.label}
                                </button>
                            )
                        }

                        return (
                            <button key={index} className="flex items-center gap-2 my-3" onClick={switchView}>
                                {el.icon}
                                {el.label}
                            </button>
                        )
                    })
                }
            </div>
            {
                loading ?
                <Skeleton width={50} height={20} className="my-3"/> :
                <div className="flex items-center gap-6 sm:gap-8">
                    <Link className="flex items-center gap-2 my-3" href="/dashboard/reservation/add">
                        <CalendarPlus className="w-4 h-4"/>
                        Add
                    </Link>
                </div>
            }
        </div>
    )
}