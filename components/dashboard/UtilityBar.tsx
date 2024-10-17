import { ChevronsLeftRight, ListFilter, SortDesc } from "lucide-react";
import { today } from "@/utils/date";
import { colors } from "@/utils/color";

interface UtilityBarProps {
    date: Date;
    variant: number;
    color: "blue" | "emerald" | "slate";
}

export default function UtilityBar ({date, variant, color} : UtilityBarProps) {
    switch (variant) {
        case 0:
            return (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-6 mb-4">
                        <span className="text-base hidden sm:inline">{today.toLocaleDateString("en-uk", {day: "numeric", month: "long"})}</span>
                        <div className="flex items-center justify-between w-full sm:justify-normal sm:w-auto gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <button className="flex items-center gap-2">
                                    <ChevronsLeftRight className="w-4 h-4"/>
                                    <span>{date.toLocaleDateString("en-uk", {day: "numeric", month: "long"})}</span>
                                </button>
                                {
                                    date === today ? 
                                    <div className="py-1 px-3 mx-2 text-xs rounded-lg border-[1px] hidden sm:block">Today</div> : null
                                }
                            </div>
                            <div className="flex items-center gap-6 sm:gap-4">
                                <button className="flex items-center gap-2 text-dark-gray">
                                    <SortDesc className="w-4 h-4"/>
                                    Sort
                                </button>
                                <button className="flex items-center gap-2 text-dark-gray">
                                    <ListFilter className="w-4 h-4"/>
                                    Filter
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center text-sm gap-x-6 mb-4">
                        <div className="flex items-center gap-x-2">
                            <div className={`w-2 h-2 rounded-full ${colors[color][2]}`}></div>
                            <span>One-time</span>
                        </div>
                        <div className="flex items-center gap-x-2">
                            <div className={`w-2 h-2 rounded-full ${colors[color][8]}`}></div>
                            <span>Recurring</span>
                        </div>
                    </div>
                </>
            )
            case 1:
                return (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2 mt-6 mb-4">
                            <span className="text-base hidden sm:inline">{today.toLocaleDateString("en-uk", {day: "numeric", month: "long", year: "numeric"})}</span>
                            <div className="flex items-center justify-between w-full sm:justify-normal sm:w-auto gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <button className="flex items-center gap-2">
                                        <ChevronsLeftRight className="w-4 h-4"/>
                                        <span>{date.toLocaleDateString("en-uk", {day: "numeric", month: "long", year: "numeric"})}</span>
                                    </button>
                                    {
                                        date === today ? <div className="py-1 px-3 mx-2 text-xs rounded-lg border-[1px] hidden md:block">Today</div> : null
                                    }
                                </div>
                                <div className="flex items-center gap-6 sm:gap-4">
                                    <button className="flex items-center gap-2 text-dark-gray">
                                        <SortDesc className="w-4 h-4"/>
                                        Sort
                                    </button>
                                    <button className="flex items-center gap-2 text-dark-gray">
                                        <ListFilter className="w-4 h-4"/>
                                        Filter
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )
            case 2:
                return (
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-6 mb-4">
                        <span className="text-base hidden sm:inline">{today.toLocaleDateString("en-us", {month: "long", year: "numeric"})}</span>
                        <div className="flex items-center justify-between w-full sm:justify-normal sm:w-auto gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <button className="flex items-center gap-2">
                                    <ChevronsLeftRight className="w-4 h-4"/>
                                    <span>{date.toLocaleDateString("en-us", {month: "long", year: "numeric"})}</span>
                                </button>
                                {
                                    date === today ? <div className="py-1 px-3 mx-2 text-xs rounded-lg border-[1px] hidden sm:block">Active Month</div> : null
                                }
                            </div>
                            <div className="flex items-center gap-6 sm:gap-4">
                                <button className="flex items-center gap-2 text-dark-gray">
                                    <SortDesc className="w-4 h-4"/>
                                    Sort
                                </button>
                                <button className="flex items-center gap-2 text-dark-gray">
                                    <ListFilter className="w-4 h-4"/>
                                    Filter
                                </button>
                            </div>
                        </div>
                    </div>
                )

    }
}