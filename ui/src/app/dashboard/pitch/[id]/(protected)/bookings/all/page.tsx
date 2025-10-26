"use client";

import useBookingContext from "@/app/context/useBookingContext";
import { Dropdown } from "@/app/components/dashboard/Input";
import { DateScopeType } from "@/app/utils/types/booking";

import { IoSearchSharp } from "react-icons/io5";

export default function Bookings() {
    const { viewType, setViewType, dateScope, setDateScope, targets, activeTarget, setActiveTarget } = useBookingContext();

    return (
        <>
            <div className="py-3 mx-6 flex items-center justify-between">
                <div className="flex items-center gap-x-3">
                    <div className="w-60 relative">
                        <IoSearchSharp className="size-4 absolute top-1/2 left-2 -translate-y-1/2 text-gray-400"/>
                        <input type="text" className="w-full border-[1px] border-gray-200 rounded-md py-2 pr-2 pl-8 text-xs" placeholder="Search"/>
                    </div>
                    <div className="w-[1px] h-6 bg-gray-200"></div>
                    <div className="flex items-center gap-x-2">
                        <div className="w-28">
                            <Dropdown 
                                options={[
                                    { label: "Today", value: "TODAY" },
                                    { label: "Tomorrow", value: "TOMORROW" },
                                    { label: "This Week", value: "WEEK" },
                                    { label: "Next Week", value: "NEXT_WEEK" },
                                    { label: "This Month", value: "MONTH" },
                                    { label: "Upcoming", value: "UPCOMING" },
                                    { label: "Past Week", value: "PAST_WEEK" },
                                    { label: "Past Month", value: "PAST_MONTH" },
                                    { label: "All Time", value: "ALL" },
                                ]}
                                value={dateScope}
                                onChange={(e) => setDateScope(e.target.value as DateScopeType)}
                                wrapperStyle={{ fontSize: "0.75rem" }}
                            />
                        </div>
                        <div className="w-36">
                            <Dropdown 
                                options={
                                    targets.map(target => ({
                                        label: target.name,
                                        value: target.id
                                    }))
                                }
                                value={activeTarget.id}
                                onChange={(e) => {setActiveTarget(targets.find(t => t.id === e.target.value)!)}}
                                wrapperStyle={{ fontSize: "0.75rem" }}
                            />
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-x-4 text-[0.8125rem]">
                    <button 
                        className={viewType === "LIST" ? "text-gray-500 cursor-not-allowed" : "text-blue-700 hover:underline cursor-pointer"}
                        disabled={viewType === "LIST"}
                        onClick={() => setViewType("LIST")}
                    >
                        List View
                    </button>
                    <button 
                        className={viewType === "WEEKLY" ? "text-gray-500 cursor-not-allowed" : "text-blue-700 hover:underline cursor-pointer"}
                        disabled={viewType === "WEEKLY"}
                        onClick={() => setViewType("WEEKLY")}
                    >
                        Weekly View
                    </button>
                </div>
            </div>
        </>
    );
};
