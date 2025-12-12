import { startOfWeek, addDays, format, subDays, isToday, isSameDay, differenceInHours } from "date-fns";

import useBookingContext from "@/app/context/useBookingContext";
import { Booking } from "@/app/utils/api/client";
import { BookingStatus } from "@/app/utils/types/booking";
import { AnimatePresence, motion } from "framer-motion";


type DateScopeType = "WEEK" | "NEXT_WEEK" | "PAST_WEEK";

const getDayRange = (dateScope: DateScopeType) => {
    switch (dateScope) {
        case "WEEK":
            {
                const days = [];
                const start = startOfWeek(new Date());
                
                for (let i = 0; i <= 6; i++) {
                    const temp = addDays(start, i);
                    days.push(temp);
                };

                return days;
            }
        case "NEXT_WEEK":
            {
                const days = [];
                const start = startOfWeek(addDays(new Date(), 7));
            
                for (let i = 0; i <= 6; i++) {
                    const temp = addDays(start, i);
                    days.push(temp);
                };

                return days;
            }
        
        case "PAST_WEEK":
            {
                const days = [];
                const start = startOfWeek(subDays(new Date(), 7));
            
                for (let i = 0; i <= 6; i++) {
                    const temp = addDays(start, i);
                    days.push(temp);
                };

                return days;
            }
        default:
            {
                const days = [];
                const start = startOfWeek(new Date());
            
                for (let i = 0; i <= 6; i++) {
                    const temp = addDays(start, i);
                    days.push(temp);
                };

                return days;
            }
    }
};

interface WeeklySlotProps {
    id: string;
    startTime: string;
    endTime: string;
    issuedTo: string;
    target: string;
    isRecurring: boolean;
    status: BookingStatus;
    duration: number;
    referenceCode: string;
}

const formatSlot = (booking: Booking) => {
    const id = booking.id;
    const referenceCode = booking.referenceCode;
    const startTime = format(booking.startDate, "HH:mm");
    const endTime = format(booking.endDate, "HH:mm");
    const target = booking.grounds.map(g => g.name).join(" & ");
    const status = booking.status as BookingStatus;
    const issuedTo = booking.issuedTo;
    const isRecurring = booking.isRecurring;
    const duration = differenceInHours(booking.endDate, booking.startDate);

    return { id, startTime, endTime, target, status, issuedTo, isRecurring, duration, referenceCode };
}

export function WeeklyViewSlot({ slot } : { slot: WeeklySlotProps }) {
    const { id, startTime, endTime, issuedTo, target, referenceCode } = slot;

    return (
        <motion.a 
            href={`/booking/${id}`} 
            className="rounded-md border-[1px] border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.15 }}
        >
            <div className="flex flex-col gap-y-0.5 p-2.5">
                <span className="text-[0.7125rem] text-gray-500">#{referenceCode}</span>
                <span className="font-medium text-[0.8125rem]">{startTime} - {endTime}</span>
                <div className="flex flex-col text-gray-500 text-xs">
                    <div className="flex items-center">
                        <span>{target}</span>
                    </div>
                    <div className="flex items-center">
                        <span>{issuedTo}</span>
                    </div>
                </div>
            </div>
        </motion.a>
    )
}

export default function WeeklyView({ bookings, omitted } : { bookings: Booking[], omitted: Array<number> }) {
    const { scope } = useBookingContext();

    const days = getDayRange(scope as DateScopeType);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="w-full grid grid-cols-7 px-6 my-3">
            {
                days.map((day, index) => {
                    const dayLabel = format(day, "EE");
                    const numberLabel = format(day, "dd");

                    if (omitted.includes(index)) {
                        return (
                            <div key={index} className="flex flex-col gap-y-2 text-[0.8rem] border-r-[1px] border-gray-100 px-2.5 text-gray-300">
                                <div className="flex flex-col mb-4">
                                    <span>{dayLabel}</span>
                                    <span className="text-xl font-medium">{numberLabel}</span>
                                </div>
                            </div>
                        )
                    }

                    const targets = bookings.filter(booking => isSameDay(booking.startDate, day));

                    if (isToday(day)) {
                        return (
                            <div key={index} className="flex flex-col gap-y-2 text-[0.8rem] border-r-[1px] border-gray-100 px-2.5">
                                <div className="flex gap-x-2 mb-4">
                                    <div className="h-full w-[2px] rounded-full bg-blue-700"></div>
                                    <div className="flex flex-col">
                                        <span>{dayLabel}</span>
                                        <span className="text-xl font-semibold">{numberLabel}</span>
                                    </div>
                                </div>
                                <AnimatePresence>
                                    {
                                        targets.map(slot => (
                                            <WeeklyViewSlot key={slot.id} slot={formatSlot(slot)}/>
                                        ))
                                    }
                                </AnimatePresence>
                            </div>
                        )
                    };

                    return (
                        <div key={index} className="flex flex-col gap-y-2 text-[0.8rem] border-r-[1px] border-gray-100 px-2.5">
                            <div className="flex flex-col mb-4">
                                <span>{dayLabel}</span>
                                <span className="text-xl font-medium">{numberLabel}</span>
                            </div>
                            <AnimatePresence>
                                {
                                    targets.map(slot => (
                                        <WeeklyViewSlot key={slot.id} slot={formatSlot(slot)}/>
                                    ))
                                }
                            </AnimatePresence>
                        </div>
                    )
                })
            }
        </motion.div>
    )
}
