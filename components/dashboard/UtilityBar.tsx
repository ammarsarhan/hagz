import { ChevronsLeftRight, ListFilter, SortDesc, Calendar, DollarSign, CreditCard } from "lucide-react";
import { today, isDate } from "@/utils/date";
import { colors } from "@/utils/color";

import Skeleton from "react-loading-skeleton";
import useReservationContext from "@/context/useReservationContext";

interface UtilityBarProps {
    date: Date;
    color: "blue" | "emerald" | "slate";
}

const SortTrigger = () => {
    return (
        <button className="flex items-center gap-2 text-dark-gray">
            <SortDesc className="w-4 h-4"/>
            Sort
        </button>
    )
}

const FilterTrigger = () => {
    return (
        <button className="flex items-center gap-2 text-dark-gray">
            <ListFilter className="w-4 h-4"/>
            Filter
        </button>
    )
}

export default function UtilityBar ({date, color} : UtilityBarProps) {
    const context = useReservationContext();
    const loading = context.data.loading;

    if (loading) {
        return (
            <div className="flex flex-col gap-y-6 my-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Skeleton width={100} height={20}/>
                    <div className="flex items-center w-full justify-normal sm:w-auto gap-4 text-sm">
                        <div className="flex items-center gap-6 sm:gap-4">
                            <Skeleton width={125} height={20}/>
                            <Skeleton width={100} height={20}/>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="flex flex-col gap-y-6 my-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-base hidden sm:inline">{today.toLocaleDateString("en-uk", {day: "numeric", month: "long"})}</span>
                    <div className="flex items-center justify-between w-full sm:justify-normal sm:w-auto gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <button className="flex items-center gap-2">
                                <ChevronsLeftRight className="w-4 h-4"/>
                                <span>{date.toLocaleDateString("en-uk", {day: "numeric", month: "long"})}</span>
                            </button>
                            {
                                isDate(date, today) ? 
                                <div className="py-1 px-3 mx-2 text-xs rounded-lg border-[1px] hidden sm:block">Today</div> : null
                            }
                        </div>
                        <div className="flex items-center gap-6 sm:gap-4">
                            <SortTrigger/>
                            <FilterTrigger/>
                        </div>
                    </div>
                </div>
                <div className="flex items-center text-sm gap-x-6">
                    <div className="flex items-center gap-x-2">
                        <div className={`w-2 h-2 rounded-full ${colors[color][2]}`}></div>
                        <span>One-time</span>
                    </div>
                    <div className="flex items-center gap-x-2">
                        <div className={`w-2 h-2 rounded-full ${colors[color][8]}`}></div>
                        <span>Recurring</span>
                    </div>
                </div>
            </div>
        </>
    )
}
