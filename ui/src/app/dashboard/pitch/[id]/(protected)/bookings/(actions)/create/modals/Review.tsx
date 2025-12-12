import { format, subHours } from "date-fns";
import { AnimatePresence, motion } from "framer-motion"

import { CreateBookingPayload, CreateBookingState } from "@/app/utils/types/booking";
import { TimeSlot } from "@/app/components/base/BookingSlot";
import { currencyFormat } from "@/app/utils/currency";
import { billingMethodMap } from "@/app/utils/types/pitch";
import { buildDateTime } from "@/app/utils/booking";

import { IoIosInformationCircleOutline } from "react-icons/io";
import { IoClose } from "react-icons/io5";
import { useMutation } from "@tanstack/react-query";
import { createBookingRequest } from "@/app/utils/api/client";
import { useRouter } from "next/navigation";

const calculateBookingPrice = (timeslots: TimeSlot[], state: CreateBookingState) => {
    let price: number = 0;
    const targets = timeslots.filter((_, i) => state.selectedTimeslots.includes(i));

    for (let i = 0; i < targets.length; i++) {
        price += targets[i].price;
        price += 15;
    };

    if (state.isRecurring === "YES" && state.recurringOptions.occurrences > 1 && state.recurringOptions.payment === "ONE_TIME") {
        price = price * state.recurringOptions.occurrences;
    }

    return price;
}

export const ReviewBookingModal = ({ isOpen, onClose, state, timeslots, id } : { isOpen: boolean, onClose: () => void, timeslots: TimeSlot[], state: CreateBookingState, id: string }) => {    
    const router = useRouter();

    const startTime = buildDateTime(state.selectedDate, state.selectedTime);
    const totalPrice = calculateBookingPrice(timeslots, state);

    const paymentDeadline = subHours(startTime, state.target.settings.paymentDeadline);
    const cancellationGrace = subHours(startTime, state.target.settings.cancellationGrace);
    const cancellationPenalty = totalPrice * (state.target.settings.cancellationFee / 100);
    const noShowPenalty = totalPrice * (state.target.settings.noShowFee / 100);

    const payload = {
        bookingId: state.bookingId!,
        startedAt: state.startedAt!,
        target: state.target.id,
        targetType: state.target.type,
        startDate: buildDateTime(state.selectedDate, state.selectedTime),
        timeslots: timeslots.filter((_, i) => state.selectedTimeslots.includes(i)).map(slot => {
            return {
                startTime: slot.startTime,
                endTime: slot.endTime
            }
        }),
        firstName: state.firstName,
        lastName: state.lastName,
        phone: state.phone,
        source: state.source,
        paymentMethod: state.isPaid === "NO" ? state.paymentMethod : null,
        notes: state.notes,
        recurringOptions: state.isRecurring === "YES" ? state.recurringOptions : null
    };

    const mutation = useMutation({
        mutationFn: ({ id, payload } : { id: string, payload: CreateBookingPayload }) => createBookingRequest(id, payload),
        mutationKey: ["dashboard", "pitch", id, "bookings"],
        onSuccess: () => {
            router.push(`/dashboard/pitch/${id}/bookings/view/all`);
        },
        onError: () => {
            console.log("An error has occurred while creating booking.");
        }
    });

    return (
        <AnimatePresence>
            {
                isOpen &&
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="fixed top-0 left-0 flex items-center justify-center w-screen h-screen z-99 bg-black/50" onClick={onClose}>
                    <div className="flex gap-x-4 bg-gray-50 rounded-md p-4 m-4" onClick={(e) => e.stopPropagation()}>
                        <div className="px-2 py-3 flex flex-col h-full justify-between w-56 text-[0.8rem]">
                            <div className="flex flex-col gap-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-x-2.5">
                                        <span className="font-medium text-sm">Booking Details</span>
                                    </div>
                                    <div className="relative">
                                        <IoIosInformationCircleOutline className="size-4.5 text-gray-500"/>
                                    </div>
                                </div>
                                <div className="w-full">
                                    <div className="flex flex-col gap-y-0.5 flex-1">
                                        <span>Booking ID</span>
                                        <span className="text-gray-500">{state.bookingId}</span>
                                    </div>
                                </div>
                                <div className="flex gap-x-2">
                                    <div className="flex flex-col gap-y-0.5 flex-1">
                                        <span>First Name</span>
                                        <span className="text-gray-500">{state.firstName}</span>
                                    </div>
                                    <div className="flex flex-col gap-y-0.5 flex-1">
                                        <span>Last Name</span>
                                        <span className="text-gray-500">{state.lastName}</span>
                                    </div>
                                </div>
                                <div className="w-full">
                                    <div className="flex flex-col gap-y-0.5 flex-1">
                                        <span>Phone Number</span>
                                        <span className="text-gray-500">{state.phone}</span>
                                    </div>
                                </div>
                                <div className="w-full">
                                    <div className="flex flex-col gap-y-0.5 flex-1">
                                        <span>Started At</span>
                                        <span className="text-gray-500">{format(state.startedAt!, "HH:mm")} on {format(state.startedAt!, "EEEE dd/MM/yyyy")}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-md p-5 flex flex-col gap-y-8 bg-white border-[1px] border-gray-300 w-lg text-[0.8125rem]">
                            <div className="flex items-start justify-between gap-x-16">
                                <div className="flex flex-col gap-y-0.5">
                                    <span>Confirm Booking</span>
                                    <h2 className="text-[1.1rem] font-semibold">{currencyFormat.format(totalPrice)}</h2>
                                    <p className="text-gray-500 text-wrap">
                                        {
                                            state.isPaid === "YES" ? 
                                            `Paid on ${format(state.startedAt!, "dd/MM/yyyy")}` : 
                                            state.paymentMethod === "CASH" ? `To be paid in cash at ${format(startTime, "HH:mm")} on ${format(startTime, "dd/MM/yyyy")} before the booking.` : 
                                            `To be paid by ${format(paymentDeadline, "HH:mm")} on ${format(paymentDeadline, "dd/MM/yyyy")}`
                                        }
                                    </p>
                                </div>
                                <button className="text-black hover:text-gray-700 transition-colors cursor-pointer" onClick={onClose}>
                                    <IoClose className="size-4"/>
                                </button>
                            </div>
                            <div className="flex flex-col">
                                <div className="border-b-[1px] border-gray-200 py-2.5 flex items-center justify-between">
                                    <span className="text-gray-600">Booking Source</span>
                                    <span>{state.source[0] + state.source.slice(1).toLowerCase()}</span>
                                </div>
                                <div className="border-b-[1px] border-gray-200 py-2.5 flex items-center justify-between">
                                    <span className="text-gray-600">Booking Type</span>
                                    <span>{state.target.type[0] + state.target.type.slice(1).toLowerCase()}</span>
                                </div>
                                <div className="border-b-[1px] border-gray-200 py-2.5 flex items-center justify-between">
                                    <span className="text-gray-600">{state.target.type === "GROUND" ? "Ground" : "Combination"}</span>
                                    <span>{state.target.name}</span>
                                </div>
                                <div className="border-b-[1px] border-gray-200 py-2.5 flex items-center justify-between">
                                    <span className="text-gray-600">Payment Method</span>
                                    <span>{state.paymentMethod && billingMethodMap.get(state.paymentMethod) || "None"}</span>
                                </div>
                                <div className="border-b-[1px] border-gray-200 py-3 flex flex-col gap-y-1.5">
                                    <span className="text-gray-600">Timeslots</span>
                                    <div className="flex flex-wrap items-center gap-x-2">
                                        {
                                            timeslots.filter((_, i) => state.selectedTimeslots.includes(i)).map((slot, index) => 
                                                <div key={index} className="p-1 rounded-md border-[1px] border-gray-200 text-gray-500">
                                                    {format(slot.startTime, "HH:mm")} - {format(slot.endTime, "HH:mm")}
                                                </div>
                                            )
                                        }
                                    </div>
                                </div>
                                <div className="flex flex-col rounded-md bg-gray-100 p-4 my-4 text-[0.785rem]">
                                    <div className="flex flex-col gap-y-0.5">
                                        <span className="text-[0.9rem] font-medium">Deadlines</span>
                                        <p className="text-gray-500 pr-2">Time ranges and fees/penalties assoicated with the booking.</p>
                                    </div>
                                    <div className="flex flex-col gap-y-2 mt-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-500">Cancellation Grace Period</span>
                                            <span>{state.isRecurring == "YES" ? `${state.target.settings.cancellationGrace} Hour(s) Before Start` : `${format(cancellationGrace, "HH:mm")} on ${format(cancellationGrace, "EE dd/MM/yyyy")}`}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-500">Cancellation Fee</span>
                                            <span>{currencyFormat.format(cancellationPenalty)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-500">No Show Fee</span>
                                            <span>{currencyFormat.format(noShowPenalty)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-x-2">
                                <button 
                                    type="button" 
                                    onClick={() => mutation.mutate({ id, payload })} 
                                    className={`
                                        flex items-center justify-center gap-x-1 rounded-md border-[1px] px-4 py-2.5 text-white 
                                        bg-black hover:bg-gray-800 cursor-pointer
                                        transition-colors
                                    `}
                                >
                                    <span className="text-xs">Book {state.target.name}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            }
        </AnimatePresence>
    )
}