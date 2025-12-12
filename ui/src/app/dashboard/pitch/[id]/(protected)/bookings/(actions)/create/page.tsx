"use client";

import { ChangeEvent, useEffect, useMemo, useReducer, useState } from "react";
import { v4 as randomUUID } from "uuid";
import { useParams } from "next/navigation";
import { addHours, format, getHours } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Skeleton from 'react-loading-skeleton'

import useBookingContext, { BookingTargetOption, TargetOption } from "@/app/context/useBookingContext";
import Input, { Dropdown, TextArea } from "@/app/components/dashboard/Input";
import { ReviewBookingModal } from "@/app/dashboard/pitch/[id]/(protected)/bookings/(actions)/create/modals/Review";
import { TimeSlot } from "@/app/components/base/BookingSlot";
import { DatePicker, TimePicker } from "@/app/components/base/DateTime";
import { PathLink } from "@/app/components/base/PathLink";
import { BillingMethod, billingMethodMap, PitchScheduleItem, PitchSettings } from "@/app/utils/types/pitch";
import { useDebouncer } from "@/app/utils/debounce";
import { formatHour } from "@/app/utils/date";
import { currencyFormat } from "@/app/utils/currency";
import { IntervalType, PaymentType, CreateBookingState } from "@/app/utils/types/booking";
import { fetchBookingSlots, fetchPitchGuest } from "@/app/utils/api/client";
import { buildDateTime, calculateRecurringEndDate, createBookingSchema, getBookingConstraints, resolveBookingData } from "@/app/utils/booking";

import { LuLoader } from "react-icons/lu";
import { FaRegCheckCircle } from "react-icons/fa";

import 'react-loading-skeleton/dist/skeleton.css';

export type CreateBookingAction =
    | { type: "SET"; field: string; value: unknown }
    | { type: "RESET" }
    | { type: "UPDATE"; payload: Partial<CreateBookingState> };

export function createBookingReducer(state: CreateBookingState, action: CreateBookingAction): CreateBookingState {
    switch (action.type) {
        case "SET":
            return { ...state, [action.field]: action.value };
        case "UPDATE":
            return { ...state, ...action.payload };
        default:
            return state;
    }
};

const createInitialState = (targets: TargetOption[], schedule: PitchScheduleItem[], settings: PitchSettings): CreateBookingState => {
    const initialTarget = targets[1] as BookingTargetOption;
    const paymentMethod = settings.paymentMethods[0];
    const isPaid = "NO";
    
    const addFactor = paymentMethod === "CASH" ? 
        initialTarget.settings.advanceBooking : 
        initialTarget.settings.paymentDeadline;

    const targetDate = addHours(new Date(), addFactor);
    const { date, time } = resolveBookingData(schedule, initialTarget, targetDate, isPaid, paymentMethod, false);

    const defaultOccurrences = 2;
    const calculatedEndDate = calculateRecurringEndDate(date, "WEEKLY", "ONE_WEEK", defaultOccurrences);

    return {
        bookingId: null,
        startedAt: null,
        target: initialTarget,
        selectedDate: date,
        selectedTime: time,
        firstName: "",
        lastName: "",
        phone: "",
        source: "PLATFORM",
        selectedTimeslots: [],
        isPaid,
        paymentMethod,
        notes: "",
        isRecurring: "NO",
        recurringOptions: {
            frequency: "WEEKLY",
            interval: "ONE_WEEK",
            occurrences: defaultOccurrences,
            endsAt: calculatedEndDate,
            payment: "PER_INSTANCE"
        }
    };
};

const DEBOUNCE_TIMEOUT = 1000;

export default function CreateBooking() {
    const { targets, schedule, settings } = useBookingContext();
    const { id } = useParams<{id: string}>();
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

    const [state, dispatch] = useReducer(
        createBookingReducer,
        { targets, schedule, settings },
        ({ targets, schedule, settings }) => createInitialState(targets, schedule, settings)
    );

    const debouncedTarget = useDebouncer(state.target.id, DEBOUNCE_TIMEOUT);
    const debouncedType = useDebouncer(state.target.type, DEBOUNCE_TIMEOUT);

    const currentDateTime = buildDateTime(state.selectedDate, state.selectedTime);
    const currentDateTimeValue = currentDateTime.getTime();
    const debouncedDateTimeValue = useDebouncer(currentDateTimeValue, DEBOUNCE_TIMEOUT);
    
    const debouncedTimestamp = useMemo(() => new Date(debouncedDateTimeValue), [debouncedDateTimeValue]);

    const debouncedPhone = useDebouncer(state.phone, DEBOUNCE_TIMEOUT - 500);

    const timeslots = useQuery({
        queryKey: ["dashboard", "pitch", id, "bookings", "create", debouncedTarget, debouncedTimestamp],
        queryFn: () => fetchBookingSlots(id, debouncedTarget, debouncedType, debouncedTimestamp),
        enabled: !!id && !!debouncedTarget && !!debouncedTimestamp,
        gcTime: 0
    });

    const account = useQuery({ 
        queryKey: ["dashboard", "pitch", id, "guest", debouncedPhone],
        queryFn: () => fetchPitchGuest(id, debouncedPhone),
        enabled: !!id && !!debouncedPhone && debouncedPhone.length === 11,
        gcTime: 0
    });

    const constraints = useMemo(() => {
        if (!state.target) return null;
        
        return getBookingConstraints(
            state.target,
            state.isPaid,
            state.paymentMethod,
            !!account.data?.user
        );
    }, [state.target, state.isPaid, state.paymentMethod, account.data?.user]);

    const closedDays = useMemo(() => {
        return schedule.filter(i => i.openTime === 0 && i.closeTime === 0);
    }, [schedule]);

    const closedHours = useMemo(() => {
        if (!state.target || !state.selectedDate) return [];
        
        const { closedHours } = resolveBookingData(
            schedule,
            state.target,
            state.selectedDate,
            state.isPaid,
            state.paymentMethod,
            !!account.data?.user
        );

        return closedHours;
    }, [state.target, schedule, state.selectedDate, state.isPaid, state.paymentMethod, account.data?.user]);

    const startDate = useMemo(() => {
        if (!state.target) return new Date();
        
        const { date } = resolveBookingData(
            schedule,
            state.target,
            new Date(),
            state.isPaid,
            state.paymentMethod,
            !!account.data?.user
        );
        
        return date;
    }, [state.target, schedule, state.isPaid, state.paymentMethod, account.data?.user]);

    useEffect(() => {
        dispatch({ type: "SET", field: "bookingId", value: randomUUID() });
        dispatch({ type: "SET", field: "startedAt", value: new Date() });
    }, []);

    useEffect(() => {
        if (!account.data) return;

        if (account.data.guest) {
            const { firstName, lastName } = account.data.guest;

            if (firstName != state.firstName || lastName != state.lastName) {
                dispatch({ 
                    type: "UPDATE", 
                    payload: {
                        ...state,
                        firstName,
                        lastName,
                    } 
                });
            };
        };

        if (account.data.user) {
            const { firstName, lastName } = account.data.user;

            if (firstName != state.firstName || lastName != state.lastName) {
                dispatch({ 
                    type: "UPDATE", 
                    payload: {
                        ...state,
                        firstName,
                        lastName,
                    } 
                });
            };
        };
    }, [account.data, state]);

    const handlePaymentChange = (value: "YES" | "NO") => {
        const { date, time } = resolveBookingData(
            schedule,
            state.target,
            state.selectedDate,
            value,
            state.paymentMethod,
            !!account.data?.user
        );

        dispatch({ 
            type: "UPDATE", 
            payload: { 
                selectedDate: date,
                selectedTime: time,
                isPaid: value,
                paymentMethod: value === "YES" ? null : settings.paymentMethods[0],
                selectedTimeslots: []
            } 
        });
    }

    const handlePaymentMethodChange = (value: BillingMethod) => {
        const { date, time } = resolveBookingData(
            schedule,
            state.target,
            state.selectedDate,
            state.isPaid,
            value,
            !!account.data?.user
        );

        dispatch({ 
            type: "UPDATE", 
            payload: { 
                selectedDate: date,
                selectedTime: time,
                paymentMethod: value,
                selectedTimeslots: []
            } 
        });
    };

    const handleTargetChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const target = targets.find(t => t.id === e.target.value)! as BookingTargetOption;

        const { date, time } = resolveBookingData(
            schedule,
            target,
            state.selectedDate,
            state.isPaid,
            state.paymentMethod,
            !!account.data?.user
        );

        dispatch({ 
            type: "UPDATE", 
            payload: { 
                selectedDate: date,
                selectedTime: time,
                target,
                selectedTimeslots: []
            } 
        });
    };

    const handleDateChange = (value: Date) => {
        if (!state.target) return;

        const { time } = resolveBookingData(
            schedule,
            state.target,
            value,
            state.isPaid,
            state.paymentMethod,
            !!account.data?.user
        );

        dispatch({ 
            type: "UPDATE", 
            payload: { 
                selectedDate: value,
                selectedTime: time,
                selectedTimeslots: []
            } 
        });
    };

    const handleUpdateRecurrenceFrequency = (value: "WEEKLY" | "MONTHLY") => {
        const weeklyOptions = ["ONE_WEEK", "TWO_WEEK", "THREE_WEEK"];
        const monthlyOptions = ["ONE_MONTH", "TWO_MONTH"];

        let newInterval = state.recurringOptions.interval;
        
        if (value === "WEEKLY" && monthlyOptions.includes(state.recurringOptions.interval)) {
            newInterval = "ONE_WEEK";
        }
        
        if (value === "MONTHLY" && weeklyOptions.includes(state.recurringOptions.interval)) {
            newInterval = "ONE_MONTH";
        }

        const endDate = calculateRecurringEndDate(
            state.selectedDate,
            value,
            newInterval as IntervalType,
            state.recurringOptions.occurrences
        );

        dispatch({ 
            type: "UPDATE",             
            payload: { 
                recurringOptions: {
                    ...state.recurringOptions,
                    frequency: value,
                    occurrences: 2,
                    interval: newInterval as IntervalType,
                    endsAt: endDate
                }
            }
        });                                             
    };

    const handleRecurrenceOccurrencesChange = (occurrences: number) => {
        const endDate = calculateRecurringEndDate(
            state.selectedDate,
            state.recurringOptions.frequency,
            state.recurringOptions.interval,
            occurrences
        );

        dispatch({ 
            type: "UPDATE",             
            payload: { 
                recurringOptions: {
                    ...state.recurringOptions,
                    occurrences,
                    endsAt: endDate
                }
            }
        });
    };

    const handleSelectTimeslot = (index: number) => {
        if (!timeslots.data || isDebouncing) return;
        
        const { maxBookingHours } = state.target.settings;
        const isSelected = state.selectedTimeslots.includes(index);

        if (isSelected) {
            const value = state.selectedTimeslots.filter(v => v !== index);
            dispatch({ type: "SET", field: "selectedTimeslots", value });
            return;
        }

        // If this is the first selection
        if (state.selectedTimeslots.length === 0) {
            dispatch({ type: "SET", field: "selectedTimeslots", value: [index] });
            return;
        }

        if (state.selectedTimeslots.length >= maxBookingHours) return;

        const sortedSlots = [...state.selectedTimeslots].sort((a, b) => a - b);
        const minSlot = sortedSlots[0];
        const maxSlot = sortedSlots[sortedSlots.length - 1];

        const isAdjacent = index === minSlot - 1 || index === maxSlot + 1;

        if (!isAdjacent) {
            return;
        }

        const newSlots = [...state.selectedTimeslots, index].sort((a, b) => a - b);
        const newMin = newSlots[0];
        const newMax = newSlots[newSlots.length - 1];
        
        for (let i = newMin; i <= newMax; i++) {
            if (!newSlots.includes(i)) {
                return;
            }
        };

        dispatch({ type: "SET", field: "selectedTimeslots", value: newSlots });
    };

    const handleOpenReviewModal = () => {
        const schema = createBookingSchema(state.target.settings);
        const parsed = schema.safeParse(state);

        if (!parsed.success) {
            console.log(parsed.error.issues)
            return;
        };

        setIsReviewModalOpen(true);
    };

    const isDebouncing = 
        state.target.id !== debouncedTarget || 
        currentDateTimeValue !== debouncedDateTimeValue;

    const isDisabled = 
        isDebouncing ||
        timeslots.isFetching || 
        state.selectedTimeslots.length < state.target.settings.minBookingHours;

    return (
        <>
            {
                isReviewModalOpen &&
                <ReviewBookingModal id={id} isOpen={isReviewModalOpen} onClose={() => setIsReviewModalOpen(false)} state={state} timeslots={timeslots.data}/>
            }
            <div className="mx-6 py-4 flex flex-col gap-y-4 text-[0.8125rem]">
                <div className="flex items-end justify-between text-gray-500 border-b-[1px] border-gray-200 border-dashed pt-1.5 pb-3">
                    <div className="flex flex-col gap-y-0.5">
                        <div className="flex items-center gap-x-1">
                            <span>Booking ID:</span>
                            {state.bookingId ? (
                                <span>{state.bookingId}</span>
                            ) : (
                                <div className="flex items-center gap-x-1">
                                    <LuLoader className="size-3 animate-spin"/>
                                    <span>Generating</span>
                                </div>
                            )}
                        </div>
                        <div>
                            <span>Pitch ID: </span>
                            <span>{id}</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-y-0.5">
                        <div className="flex items-center gap-x-1">
                            <span>Started On:</span>
                            {state.startedAt ? (
                                <span>{state.startedAt.toUTCString()}</span>
                            ) : (
                                <div className="flex items-center gap-x-1">
                                    <LuLoader className="size-3 animate-spin"/>
                                    <span>Loading</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-x-8 relative">
                    <div className="flex flex-col gap-y-8 py-2">
                        <div>
                            <div className="flex flex-col gap-y-0.5">
                                <h2 className="text-base font-semibold">User Details</h2> 
                                <p className="text-gray-500">Details about the user/guest (e.g: name, phone, email).</p>
                            </div>
                            <div className="flex flex-col gap-y-3 mt-4">
                                <div className="flex items-center gap-x-2 w-2/3">
                                    {
                                        <>
                                            <Input 
                                                label="First Name" 
                                                placeholder="First Name"
                                                value={state.firstName}
                                                readOnly={account.data}
                                                onChange={(e) => dispatch({ type: "SET", field: "firstName", value: e.target.value})}
                                                required
                                            />
                                            <Input 
                                                label="Last Name" 
                                                placeholder="Last Name"
                                                value={state.lastName}
                                                readOnly={account.data}
                                                onChange={(e) => dispatch({ type: "SET", field: "lastName", value: e.target.value})}
                                                required
                                            />
                                        </>
                                    }
                                </div>
                                <div className="w-1/2! relative">
                                    <Input 
                                        label="Phone" 
                                        placeholder="Phone Number"
                                        value={state.phone}
                                        onChange={(e) => dispatch({ type: "SET", field: "phone", value: e.target.value})}
                                        required
                                    />
                                    <AnimatePresence>
                                        {
                                            ((account.data && account.data.guest) || (account.data && account.data.user)) &&
                                            <motion.div
                                                initial={{ opacity: 0 }} 
                                                animate={{ opacity: 1 }} 
                                                exit={{ opacity: 0 }} 
                                                transition={{ duration: 0.25 }} 
                                                className="flex flex-col gap-y-3"
                                            >
                                                <FaRegCheckCircle className="absolute right-2.5 bottom-2.5 size-4 text-green-700"/>
                                            </motion.div>
                                        }
                                    </AnimatePresence>
                                </div>
                            </div>
                            <p className="text-gray-500 mt-2">
                                {
                                    account.data ? (
                                        account.data.guest ? `${account.data.guest.firstName} is a recurring booker at your pitch. Their last booking was set for ${format(account.data.guest.booking.startDate, "dd/MM/yyyy")} on ${account.data.guest.booking.target} for ${account.data.guest.booking.duration} ${account.data.guest.booking.duration === 1 ? "hour" : "hours"}.` : 
                                        `${account.data.user.firstName} already has an account. Using this phone number will require manual approval by them. ${account.data.user.booking ? `Their last booking on your pitch was set for ${format(account.data.user.booking.startDate, "dd/MM/yyyy")} on ${account.data.user.booking.target} for ${account.data.user.booking.duration} ${account.data.user.booking.duration === 1 ? "hour" : "hours"}.` : "This is their first booking on your pitch."}`
                                    ) :
                                    "Creating a booking stores the customer's phone number to track their booking history and provide a better experience."
                                }
                            </p>
                        </div>
                        <div>
                            <div className="flex flex-col gap-y-0.5">
                                <h2 className="text-base font-medium">Basic Information</h2> 
                                <p className="text-gray-500">Some basic details about the booking (e.g: target, start time, duration).</p>
                            </div>
                            <div className="flex flex-col gap-y-4 mt-4">
                                <div className="flex flex-col gap-y-2.5">
                                    <span>Booking Source</span>
                                    <div className="flex items-center gap-x-2 text-xs">
                                        <PathLink isSelected={state.source === "PLATFORM"} title={"Online"} onClick={() => dispatch({ type: "SET", field: "source", value: "PLATFORM" })} />
                                        <PathLink isSelected={state.source === "IN_PERSON"} title={"In-Person"} onClick={() => dispatch({ type: "SET", field: "source", value: "IN_PERSON" })} />
                                        <PathLink isSelected={state.source === "PHONE"} title={"Phone"} onClick={() => dispatch({ type: "SET", field: "source", value: "PHONE" })} />
                                        <PathLink isSelected={state.source === "OTHER"} title={"Other"} onClick={() => dispatch({ type: "SET", field: "source", value: "OTHER" })} />
                                    </div>
                                    <p className="text-gray-500">Any bookings created online need to abide by both the pitch settings and the ground and combination settings. Other booking sources are not bound by settings.</p>
                                </div>
                                <div className="flex flex-col gap-y-2.5">
                                    <span>Payment Status</span>
                                    <div className="w-80">
                                        <Dropdown 
                                            value={state.isPaid}
                                            onChange={(e) => handlePaymentChange(e.target.value as "YES" | "NO")}
                                            options={[
                                                { label: "Completed", value: "YES" },
                                                { label: "Pending", value: "NO" }
                                            ]}
                                        />
                                    </div>
                                    <p className="text-gray-500">Marking the payment as completed will not generate a payment link for the booking.</p>
                                </div>
                                {
                                    state.isPaid === "NO" &&
                                    <div className="flex flex-col gap-y-2.5">
                                        <span>Payment Method</span>
                                        <div className="flex items-center gap-x-2 text-xs">
                                            {
                                                settings.paymentMethods.map((method, index) => {
                                                    return (
                                                        <PathLink 
                                                            key={index}
                                                            isSelected={state.paymentMethod === method} 
                                                            title={billingMethodMap.get(method)!} 
                                                            onClick={() => handlePaymentMethodChange(method)}
                                                        />
                                                    )
                                                })
                                            }
                                        </div>
                                        <p className="text-gray-500">Marking the payment method as cash will not generate a payment link for the booking and doesn&apos;t take the payment deadline into account when showing available times.</p>
                                    </div>
                                }
                                <div className="flex flex-col gap-y-2">
                                    <span>Target Ground/Combination</span>
                                    <div className="w-108">
                                        <Dropdown
                                            options={
                                                targets.filter(t => t.type != "ALL").map(target => ({
                                                    label: target.name,
                                                    value: target.id
                                                }))
                                            }
                                            value={state.target.id}
                                            onChange={(e) => handleTargetChange(e)}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-y-2">
                                    <span>Start Date</span>
                                    <div className="w-80">
                                        <DatePicker 
                                            title="Pick a Start Date"
                                            description="On which day will your booking start?" 
                                            value={state.selectedDate} 
                                            onChange={(value) => handleDateChange(value)}
                                            omittedDays={closedDays.map(c => c.dayOfWeek)}
                                            startDate={startDate}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-y-2">
                                    <div className="flex flex-col gap-y-0.5">
                                        <span>Start Time</span>
                                        {constraints && (
                                            <p className="text-gray-500">
                                                {constraints.explanation}
                                            </p>
                                        )}
                                    </div>
                                    <div className="w-80">
                                        <TimePicker
                                            value={state.selectedTime}
                                            onChange={(value) => dispatch({ type: "UPDATE", payload: { ...state, selectedTime: value, selectedTimeslots: [] } })}
                                            omittedHours={closedHours}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-y-4">
                                    <div className="flex flex-col gap-y-0.5">
                                        <span>Booking Slots <span className="text-gray-700">(Select {state.target.settings.minBookingHours}-{state.target.settings.maxBookingHours} hours)</span></span>
                                        <p className="text-gray-500">Shows the next available slots within the specified timeframe.</p>
                                    </div>
                                    <div className="flex items-center flex-wrap gap-x-4 gap-y-2">
                                        <AnimatePresence mode="wait">
                                            {
                                                timeslots.isFetching ?
                                                <motion.div 
                                                    key={`loading-${debouncedTarget}-${debouncedTimestamp}`}
                                                    initial={{ opacity: 0 }} 
                                                    animate={{ opacity: 1 }} 
                                                    exit={{ opacity: 0 }} 
                                                    transition={{ duration: 0.25 }} 
                                                    className="flex flex-wrap gap-x-4 gap-y-2"
                                                >
                                                    {
                                                        [...Array(6)].map((_, i) => {
                                                            return (
                                                                <div className="h-28 w-46" key={i}>
                                                                    <Skeleton className="w-full! h-full"/>
                                                                </div>
                                                            )
                                                        })
                                                    }
                                                </motion.div> :
                                                <motion.div 
                                                    key={`loaded-${debouncedTarget}-${debouncedTimestamp}`}
                                                    initial={{ opacity: 0 }} 
                                                    animate={{ opacity: 1 }} 
                                                    exit={{ opacity: 0 }} 
                                                    transition={{ duration: 0.25 }} 
                                                    className="flex flex-wrap gap-x-4 gap-y-2"
                                                >
                                                    {
                                                        timeslots.data.map((item: TimeSlot, index: number) => {
                                                            const isSelected = state.selectedTimeslots.includes(index);

                                                            if (item.available) {
                                                                return (
                                                                    <button 
                                                                        key={index} 
                                                                        className={`
                                                                            h-28 w-46 flex flex-col items-center justify-center gap-y-0.5 rounded-md border-[1px] 
                                                                            ${isSelected ? "bg-blue-50 border-blue-700 cursor-pointer!" : "border-gray-200"} 
                                                                            ${state.target.settings.maxBookingHours <= state.selectedTimeslots.length || isDebouncing ? "cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"} 
                                                                            transition-colors`
                                                                        }
                                                                        onClick={() => handleSelectTimeslot(index)}
                                                                    >
                                                                        <span className={`${isSelected ? "text-blue-700" : "text-black"} transition-colors`}>{formatHour(getHours(item.startTime), true)} - {formatHour(getHours(item.endTime), true)}</span>
                                                                        <span className={`${isSelected ? "text-blue-700" : "text-gray-500"} transition-colors`}>{item.available ? "Available" : item.reason}</span>
                                                                        <span className={`${isSelected ? "text-blue-700" : "text-gray-500"} transition-colors`}>{currencyFormat.format(item.price)}</span>
                                                                    </button>
                                                                )
                                                            };
                                                            
                                                            return (
                                                                <div key={index} className="h-28 w-46 flex flex-col items-center justify-center gap-y-0.5 rounded-md border-[1px] border-gray-200 cursor-not-allowed">
                                                                    <span>{formatHour(getHours(item.startTime), true)} - {formatHour(getHours(item.endTime), true)}</span>
                                                                    <span className="text-gray-500 text-center">{item.available ? "Available" : item.reason}</span>
                                                                </div>
                                                            )
                                                        })
                                                    }
                                                </motion.div>
                                            }
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="flex flex-col gap-y-0.5">
                                <h2 className="text-base font-medium">Additional Information</h2> 
                                <p className="text-gray-500">Select certain special booking options and add important notes about the booking.</p>
                            </div>
                            <div className="flex flex-col gap-y-4 mt-4">
                                <div className="flex flex-col gap-y-2">
                                    <span>Recurring Booking</span>
                                    <div className="w-80">
                                        <Dropdown 
                                            value={state.isRecurring}
                                            onChange={(e) => dispatch({ type: "SET", field: "isRecurring", value: e.target.value})}
                                            options={[
                                                { label: "One-time", value: "NO" },
                                                { label: "Recurring", value: "YES" }
                                            ]}
                                        />
                                    </div>
                                    <p className="text-gray-500">If the customer frequently books the selected timeslots, you can create a recurring booking.</p>
                                </div>
                                <AnimatePresence>
                                    {
                                        state.isRecurring === "YES" &&
                                        <motion.div
                                            initial={{ opacity: 0 }} 
                                            animate={{ opacity: 1 }} 
                                            exit={{ opacity: 0 }} 
                                            transition={{ duration: 0.25 }}
                                            className="flex flex-col gap-y-2.5"
                                        >
                                            <div className="flex flex-col gap-y-3.5">
                                                <div className="flex gap-x-4">
                                                    <div className="w-80">
                                                        <Dropdown
                                                            label="Booking Frequency"
                                                            value={state.recurringOptions.frequency}
                                                            onChange={(e) => handleUpdateRecurrenceFrequency(e.target.value as "WEEKLY" | "MONTHLY")}
                                                            options={[
                                                                { label: "Weekly", value: "WEEKLY" },
                                                                { label: "Monthly", value: "MONTHLY" }
                                                            ]}
                                                        />
                                                    </div>
                                                    <div className="w-80">
                                                        <Dropdown
                                                            label="Repeats"
                                                            value={state.recurringOptions.interval}
                                                            onChange={(e) => {
                                                                const newInterval = e.target.value as IntervalType;
                                                                const endDate = calculateRecurringEndDate(
                                                                    state.selectedDate,
                                                                    state.recurringOptions.frequency,
                                                                    newInterval,
                                                                    state.recurringOptions.occurrences
                                                                );
                                                                
                                                                dispatch({ 
                                                                    type: "UPDATE",             
                                                                    payload: { 
                                                                        recurringOptions: {
                                                                            ...state.recurringOptions,
                                                                            interval: newInterval,
                                                                            occurrences: 2,
                                                                            endsAt: endDate
                                                                        }
                                                                    }
                                                                });
                                                            }}
                                                            options={
                                                                state.recurringOptions.frequency === "WEEKLY" ?
                                                                [
                                                                    { label: "Once Per Week", value: "ONE_WEEK" },
                                                                    { label: "Twice Per Month", value: "TWO_WEEK" },
                                                                    { label: "Every Three Weeks", value: "THREE_WEEK" },
                                                                ] :
                                                                [
                                                                    { label: "Once Every Month", value: "ONE_MONTH" },
                                                                    { label: "Every Two Months", value: "TWO_MONTH" },
                                                                ]
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                                <div className="w-80">
                                                    <Input
                                                        label="Number of Bookings"
                                                        type="number"
                                                        min={2}
                                                        max={state.recurringOptions.frequency === "MONTHLY" && state.recurringOptions.interval === "TWO_MONTH" ? 3 : 6}
                                                        value={state.recurringOptions.occurrences}
                                                        onChange={(e) => handleRecurrenceOccurrencesChange(parseInt(e.target.value) || 2)}
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-y-2 w-96">
                                                    <span>Payment Schedule</span>
                                                    <Dropdown 
                                                        value={state.recurringOptions.payment}
                                                        onChange={(e) => dispatch({ type: "UPDATE", payload: { recurringOptions: { ...state.recurringOptions, payment: e.target.value as PaymentType } } })}
                                                        options={[
                                                            { label: "Upfront", value: "ONE_TIME" },
                                                            { label: "Per Booking", value: "PER_INSTANCE" }
                                                        ]}
                                                    />
                                                    <p className="text-gray-500">Recurring bookings are not confirmed until paid for upfront, they are simply reserved for the customer until they confirm by payment.</p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    }
                                </AnimatePresence>
                            </div>
                            <div className="flex flex-col gap-y-4 mt-4">
                                <div className="flex flex-col gap-y-2.5 max-w-2/3">
                                    <TextArea
                                        label={"Additional Notes"}
                                        value={state.notes}
                                        onChange={(e) => dispatch({ type: "SET", field: "notes", value: e.target.value })}
                                        placeholder={"Add details about this booking..."}
                                    />
                                </div> 
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-end my-2">
                    <button onClick={handleOpenReviewModal} disabled={isDisabled} className={`${(!isDisabled) ? "bg-black hover:bg-black/85 cursor-pointer text-white" : "bg-gray-600 cursor-not-allowed"} px-4 py-2.5 rounded-md transition-colors`}>
                        <span className="text-white text-[0.8rem]">Book {state.target.type[0] + state.target.type.slice(1).toLowerCase()}</span>
                    </button>
                </div>
            </div>
        </>
    )
};