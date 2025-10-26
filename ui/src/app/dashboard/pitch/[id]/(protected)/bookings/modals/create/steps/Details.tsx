import { Dispatch, useMemo } from "react";
import useBookingContext from "@/app/context/useBookingContext";
import { PathLink } from "@/app/components/base/PathLink";
import { Dropdown } from "@/app/components/dashboard/Input";
import { BookingSlotPicker, DatePicker, TimePicker } from "@/app/components/base/DateTime";
import { CreateBookingAction, CreateBookingPayload } from "@/app/dashboard/pitch/[id]/(protected)/bookings/modals/create/reducer";

export default function Details({ data, dispatch } : { data: CreateBookingPayload, dispatch: Dispatch<CreateBookingAction> }) {
    const { targets } = useBookingContext();

    const bookableTargets = useMemo(() => {
        return targets.filter(t => t.id !== "ALL").map(target => ({
            label: target.name,
            value: target.id
        }));
    }, [targets]);

    return (
        <div className="flex flex-col gap-y-6 w-full">
            <div className="text-[0.8125rem] flex flex-col gap-y-4">
                <div className="flex flex-col gap-y-2">
                    <span>Source</span>
                    <div className="flex items-center gap-x-2">
                        <PathLink 
                            isSelected={data.source === "PLATFORM"} 
                            className="text-xs flex-1 text-nowrap" 
                            title={"Online"} 
                            onClick={() => dispatch({ type: "SET", field: "source", value: "PLATFORM" })}
                        />
                        <PathLink
                            isSelected={data.source === "IN_PERSON"}
                            className="text-xs flex-1 text-nowrap" 
                            title={"In-Person"} 
                            onClick={() => dispatch({ type: "SET", field: "source", value: "IN_PERSON" })}
                        />
                        <PathLink
                            isSelected={data.source === "PHONE"}
                            className="text-xs flex-1 text-nowrap" 
                            title={"Phone"} 
                            onClick={() => dispatch({ type: "SET", field: "source", value: "PHONE" })}
                        />
                        <PathLink
                            isSelected={data.source === "OTHER"}  
                            className="text-xs flex-1 text-nowrap"
                            title={"Other"}
                            onClick={() => dispatch({ type: "SET", field: "source", value: "OTHER" })}
                        />
                    </div>
                    <p className="text-gray-500 text-xs mt-1">Note: Bookings created online will have to abide by the pitch/ground-specific settings set by the owner when creating the pitch.</p>
                </div>
                <div className="flex flex-col gap-y-2">
                    <span>Ground/Combination</span>
                    <div className="flex items-center gap-x-2">
                        <Dropdown
                            options={bookableTargets}
                            value={data.target.id}
                            onChange={(e) => { dispatch({ type: "SET", field: "target", value: targets.find(t => t.id === e.target.value)! })}}
                            wrapperStyle={{ fontSize: "0.775rem" }}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-y-2">
                    <span>Date</span>
                    <DatePicker value={new Date()}/>
                </div>
                <div>
                    <span>Start Time</span>
                    <TimePicker/>
                </div>
                <div>
                    <span>Slots</span>
                    <BookingSlotPicker/>
                </div>
                </div>
        </div>
    )
}