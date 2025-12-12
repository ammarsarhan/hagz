"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import useBookingContext from "@/app/context/useBookingContext";
import { Dropdown } from "@/app/components/dashboard/Input";
import WeeklyView from "@/app/components/main/WeeklyView";
import ListView from "@/app/components/main/ListView";
import { DateScopeType, resolveScopeDates } from "@/app/utils/types/booking";
import { fetchBookings } from "@/app/utils/api/client";

import { IoSearchSharp } from "react-icons/io5";
import { AnimatePresence } from "framer-motion";

export default function Bookings() {
    const { view, setView, scope, setScope, targets, target, setTarget, schedule } = useBookingContext();
    const { id } = useParams<{id: string }>();

    const isList = view === "LIST";
    
    const omitted = schedule.filter(s => s.openTime === 0 && s.closeTime === 0).map(s => s.dayOfWeek);
    const { startDate, endDate } = resolveScopeDates(scope);

    const { data, isFetching, isError, error } = useQuery({
        queryFn: () => fetchBookings({ 
            id, 
            startDate, 
            endDate, 
            target: target.id,
            type: target.type 
        }),
        queryKey: ["dashboard", "pitch", id, "bookings", target.id, target.type, scope],
        enabled: !!target.id && !!target.type && !!scope,
        gcTime: 0
    });
    
    return (
        <>
            <div className="py-3 mx-6 flex items-center justify-between">
                <div className="flex items-center gap-x-3">
                    {
                        isList ?
                        <>
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
                                        value={scope}
                                        onChange={(e) => setScope(e.target.value as DateScopeType)}
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
                                        value={target.id}
                                        onChange={(e) => {setTarget(targets.find(t => t.id === e.target.value)!)}}
                                        wrapperStyle={{ fontSize: "0.75rem" }}
                                    />
                                </div>
                            </div>
                        </> :
                        <>
                            <div className="w-28">
                                <Dropdown
                                    options={[
                                        { label: "This Week", value: "WEEK" },
                                        { label: "Next Week", value: "NEXT_WEEK" },
                                        { label: "Past Week", value: "PAST_WEEK" }
                                    ]}
                                    value={scope}
                                    onChange={(e) => setScope(e.target.value as DateScopeType)}
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
                                    value={target.id}
                                    onChange={(e) => {setTarget(targets.find(t => t.id === e.target.value)!)}}
                                    wrapperStyle={{ fontSize: "0.75rem" }}
                                />
                            </div>
                        </>
                    }
                </div>
                <div className="flex items-center gap-x-4 text-[0.8125rem]">
                    <button 
                        className={!isList ? "text-gray-500 cursor-not-allowed" : "text-blue-700 hover:underline cursor-pointer"}
                        disabled={!isList}
                        onClick={() => setView("WEEKLY")}
                    >
                        Weekly View
                    </button>
                    <button 
                        className={isList ? "text-gray-500 cursor-not-allowed" : "text-blue-700 hover:underline cursor-pointer"}
                        disabled={isList}
                        onClick={() => setView("LIST")}
                    >
                        List View
                    </button>
                </div>
            </div>
            {
                isError && !isFetching && (
                    <div className="flex flex-col items-center justify-center py-12 gap-y-2">
                        <span className="text-sm text-red-500">Failed to load bookings.</span>
                        {error && (
                            <span className="text-xs text-gray-500">{error.message}</span>
                        )}
                    </div>
                )
            }
            <AnimatePresence mode="wait">
                {
                    !isFetching && !isError && data && (
                        isList ? 
                            <ListView bookings={data.bookings} /> : 
                            <WeeklyView bookings={data.bookings} omitted={omitted}/>
                    )
                }
            </AnimatePresence>
        </>
    );
};