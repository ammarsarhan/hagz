import { useEffect, useMemo, useRef, useState } from "react"
import { format, getDay, getDaysInMonth, getMonth, getYear, isBefore, isSameDay, isToday, startOfDay, startOfMonth } from "date-fns"
import { AnimatePresence, motion } from "framer-motion"
import { formatHour } from "@/app/utils/date"
import { FaCheck, FaChevronDown, FaRegCalendarDays, FaRegClock } from "react-icons/fa6"
import { IoIosClose } from "react-icons/io"
import { RecurringOptions } from "@/app/utils/types/booking"
import { calculateRecurringEndDate, resolveRecurringDates } from "@/app/utils/booking"

interface DatePickerGridItem {
    label: string;
    lengthOfMonth: number;
    startsOn: number;
    layout: Array<null | {
        label: string,
        date: Date
    }>;
    year: string;
}

interface DatePickerProps {
    value: Date;
    onChange: (value: Date) => void;
    title: string;
    description: string;
    omittedDays?: Array<number>;
    startDate?: Date;
}

interface DateViewerGridItem {
    label: string;
    lengthOfMonth: number;
    startsOn: number;
    layout: Array<null | {
        label: string;
        date: Date;
        isHighlighted: boolean;
    }>;
    year: string;
}

const days = ["S", "M", "T", "W", "T", "F", "S"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function DateViewer({ startDate, omittedDays, options }: { startDate: Date; omittedDays: number[], options: RecurringOptions }) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const endDate = useMemo(() => {
        return calculateRecurringEndDate(startDate, options.frequency, options.interval, options.occurrences);
    }, [startDate, options]);

    const grid = useMemo(() => {
        const highlightedDates = resolveRecurringDates(startDate, options.frequency, options.interval, options.occurrences);

        const startMonth = getMonth(startDate);
        const currentYear = getYear(startDate);
        const endMonth = getMonth(endDate);
        const endYear = getYear(endDate);

        const monthsToShow = (endYear - currentYear) * 12 + (endMonth - startMonth) + 1;

        const items: Array<DateViewerGridItem> = [];

        for (let offset = 0; offset < monthsToShow; offset++) {
            const month = (startMonth + offset) % 12;
            const year = currentYear + Math.floor((startMonth + offset) / 12);

            const date = new Date(year, month, 1);

            const label = months[month];
            const lengthOfMonth = getDaysInMonth(date);
            const startsOn = getDay(startOfMonth(date));

            const layout = [];

            for (let i = 0; i < startsOn; i++) layout.push(null);

            for (let d = 1; d <= lengthOfMonth; d++) {
                const dayDate = new Date(year, month, d);

                const isHighlighted = highlightedDates.some(recurringDate =>
                    isSameDay(dayDate, recurringDate)
                );

                layout.push({
                    label: `${d}`,
                    date: isToday(dayDate) ? new Date() : dayDate,
                    isHighlighted
                });
            }

            items.push({
                label,
                lengthOfMonth,
                startsOn,
                layout,
                year: `${year}`,
            });
        }

        return items;
    }, [startDate, endDate, options]);

    return (
        <div className="text-[0.8125rem]" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="cursor-pointer hover:bg-gray-50 transition-colors w-full rounded-md bg-white border-[1px] border-gray-200 py-2 px-3 flex justify-between gap-x-3 items-center text-left"
            >
                <div className="flex items-center gap-x-2">
                    <FaRegCalendarDays className="size-3" />
                    <span className="truncate">
                        {format(endDate, "dd/MM/yyyy")}
                    </span>
                </div>
                <span className="text-blue-700 text-[0.785rem]">View Schedule</span>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        className="fixed top-0 left-0 flex items-center justify-center w-screen h-screen z-99 bg-black/50"
                        onClick={() => setOpen(false)}
                    >
                        <div
                            className="w-xl flex flex-col bg-white border border-gray-200 rounded-md overflow-auto z-100 p-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-x-4 w-full pb-6">
                                <div className="flex-1 flex flex-col gap-y-0.5 mt-1">
                                    <h2 className="text-sm font-medium">Expected Schedule</h2>
                                    <p className="text-[0.8rem] text-gray-500 max-w-96">
                                        Visual indicator for each booking and deadlines to stick to.
                                    </p>
                                </div>
                                <button
                                    className="flex-shrink-0 hover:text-gray-600 cursor-pointer"
                                    type="button"
                                    onClick={() => setOpen(false)}
                                >
                                    <IoIosClose className="size-6" />
                                </button>
                            </div>
                            <div className="flex flex-col gap-y-8 max-h-96 overflow-y-scroll">
                                {
                                    grid.map((month, index) => {
                                        return (
                                            <div key={index} className="last:pb-6">
                                                <h1 className="mb-6 font-medium text-base">
                                                    {month.label} {month.year}
                                                </h1>
                                                <div className="grid grid-cols-7 mb-4">
                                                    {days.map((label, i) => {
                                                        return (
                                                            <div key={i} className="w-full flex items-center justify-center">
                                                                <span className="text-gray-500 font-medium">{label}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="grid grid-cols-7 gap-y-4">
                                                    {
                                                        month.layout.map((day, i) => {
                                                            if (!day) {
                                                                return (
                                                                    <div key={i} className="flex items-center justify-center">
                                                                        <div className="size-8 rounded-full flex items-center justify-center"></div>
                                                                    </div>
                                                                );
                                                            }

                                                            if (day.isHighlighted) {
                                                                return (
                                                                    <div key={i} className="flex items-center justify-center">
                                                                        <div className="size-8 rounded-full border-[1px] border-blue-700 text-blue-700 flex items-center justify-center font-medium">
                                                                            {day.label}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }

                                                            if (isToday(day.date)) {
                                                                return (
                                                                    <div key={i} className="flex items-center justify-center">
                                                                        <div className="size-8 rounded-full border-[1px] border-blue-700/80 text-blue-700/80 flex items-center justify-center font-medium">
                                                                            {day.label}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <div key={i} className="flex items-center justify-center">
                                                                    <div className="size-8 rounded-full flex items-center justify-center text-gray-700">
                                                                        {day.label}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    }
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function DatePicker({ value, onChange, title, description, omittedDays, startDate = new Date() } : DatePickerProps) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [open, setOpen] = useState(false);

    const label = `${format(value, "EEEE, dd MMMM yyyy")}`.trim();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const grid = useMemo(() => {
        const startMonth = getMonth(startDate);
        const currentYear = getYear(startDate);

        const items: Array<DatePickerGridItem> = [];

        for (let offset = 0; offset < 6; offset++) {
            const month = (startMonth + offset) % 12;
            const year = currentYear + Math.floor((startMonth + offset) / 12);

            const date = new Date(year, month, 1);

            const label = months[month];
            const lengthOfMonth = getDaysInMonth(date);
            const startsOn = getDay(startOfMonth(date));

            const layout = [];

            for (let i = 0; i < startsOn; i++) layout.push(null);
            for (let d = 1; d <= lengthOfMonth; d++) {
                const date = new Date(year, month, d);

                layout.push({
                    label: `${d}`,
                    date: isToday(date) ? new Date() : date
                })
            };

            items.push({
                label,
                lengthOfMonth,
                startsOn,
                layout,
                year: `${year}`,
            });
        }

        return items;
    }, [startDate]);

    return (
        <div className="text-[0.8125rem]" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="cursor-pointer w-full rounded-md bg-white border-[1px] border-gray-200 py-2 px-3 flex justify-between gap-x-3 items-center text-left"
            >
                <div className="flex items-center gap-x-2">
                    <FaRegCalendarDays className="size-3"/>
                    <span className="truncate">
                        {label}
                    </span>
                </div>
                <FaChevronDown
                    className={`text-gray-500 size-3 transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>
            <AnimatePresence>
                {
                    open &&
                    (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="fixed top-0 left-0 flex items-center justify-center w-screen h-screen z-99 bg-black/50" onClick={() => setOpen(false)}>
                            <div className="w-xl flex flex-col bg-white border border-gray-200 rounded-md overflow-auto z-100 p-6" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-start justify-between gap-x-4 w-full pb-6">
                                    <div className="flex-1 flex flex-col gap-y-0.5 mt-1">
                                        <h2 className="text-sm font-medium">{title}</h2>
                                        <p className="text-[0.8rem] text-gray-500 max-w-96">{description}</p>
                                    </div>
                                    <button className="flex-shrink-0 hover:text-gray-600 cursor-pointer" type="button" onClick={() => setOpen(false)}>
                                        <IoIosClose className="size-6"/>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-y-8 max-h-96 overflow-y-scroll">
                                    {
                                        grid.map((month, index) => {
                                            return (
                                                <div key={index} className="last:pb-6">
                                                    <h1 className="mb-6 font-medium text-base">{month.label} {month.year}</h1>
                                                    <div className="grid grid-cols-7 mb-4">
                                                        {
                                                            days.map((label, i) => {
                                                                if (omittedDays && omittedDays.includes(i)) {
                                                                    return (
                                                                        <div key={i} className="w-full flex items-center justify-center">
                                                                            <span className="text-gray-300 font-medium">{label}</span>
                                                                        </div>
                                                                    )
                                                                };

                                                                return (
                                                                    <div key={i} className="w-full flex items-center justify-center">
                                                                        <span className="text-gray-500 font-medium">{label}</span>
                                                                    </div>
                                                                )
                                                            })
                                                        }
                                                    </div>
                                                    <div className="grid grid-cols-7 gap-y-4">
                                                        {
                                                            month.layout.map((day, i) => {  
                                                                if (day && startDate && isBefore(startOfDay(day.date), startOfDay(startDate))) {
                                                                    return (
                                                                        <div key={i} className="flex items-center justify-center">
                                                                            <span className="size-8 rounded-full flex items-center justify-center text-gray-300">
                                                                                {day.label}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                };

                                                                if (day && isBefore(startOfDay(day.date), startOfDay(new Date()))) {
                                                                    return (
                                                                        <div key={i} className="flex items-center justify-center">
                                                                            <span className="size-8 rounded-full flex items-center justify-center text-gray-300">
                                                                                {day.label}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                }

                                                                if (day && omittedDays && omittedDays.includes(getDay(day.date))) {
                                                                    return (
                                                                        <div key={i} className="flex items-center justify-center">
                                                                            <span className="size-8 rounded-full flex items-center justify-center line-through text-gray-300">{day.label}</span>
                                                                        </div>
                                                                    )
                                                                };

                                                                if (day && isSameDay(day.date, value)) {
                                                                    return (
                                                                        <div key={i} className="flex items-center justify-center">
                                                                            <span className="text-white size-8 rounded-full bg-blue-700 flex items-center justify-center">{day.label}</span>
                                                                        </div>
                                                                    )
                                                                };

                                                                if (day && isToday(day.date)) {
                                                                    return (
                                                                        <div key={i} className="flex items-center justify-center">
                                                                            <button onClick={() => onChange(day.date)} className="size-8 rounded-full flex items-center justify-center border-[1px] border-blue-700/80 text-blue-700/80 cursor-pointer font-medium">{day.label}</button>
                                                                        </div>
                                                                    )
                                                                };     

                                                                if (day) {
                                                                    return (
                                                                        <div key={i} className="flex items-center justify-center">
                                                                            <button onClick={() => onChange(day.date)} className="size-8 rounded-full flex items-center justify-center cursor-pointer">{day.label}</button>
                                                                        </div>
                                                                    )
                                                                };

                                                                return (
                                                                    <div key={i} className="flex items-center justify-center">
                                                                        <div className="size-8 rounded-full flex items-center justify-center cursor-pointer"></div>
                                                                    </div>
                                                                )
                                                            })
                                                        }
                                                    </div>
                                                </div>
                                            )
                                        })
                                    }
                                </div>
                            </div>
                        </motion.div>
                    )
                }
            </AnimatePresence>
        </div>
    )
};

interface TimePickerProps {
    value: number,
    onChange: (value: number) => void,
    omittedHours: Array<number>
}

const hours = Array.from({ length: 24 }, (_, i) => i);

export function TimePicker({ value, onChange, omittedHours } : TimePickerProps) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isDisabled = hours.every(h => omittedHours.includes(h));

    return (
        <div ref={wrapperRef}>   
            <button
                type="button"
                disabled={isDisabled}
                onClick={() => setOpen((prev) => !prev)}
                className={`${isDisabled ? "cursor-not-allowed text-gray-500" : "cursor-pointer"} relative w-full rounded-md bg-white border-[1px] border-gray-200 py-2 px-3 flex justify-between gap-x-3 items-center text-left`}
            >
                <div className="flex items-center gap-x-2">
                    <FaRegClock className="size-3"/>
                    {
                        isDisabled ?
                        <span className="truncate">
                            No available timeslots
                        </span> :
                        <span className="truncate">
                            {formatHour(value, true)}
                        </span>
                    }
                </div>
                <FaChevronDown
                    className={`text-gray-500 size-3 transition-transform ${open ? "rotate-180" : ""}`}
                />
                {
                    open && (
                        <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto z-10">
                            {
                                hours.map(hour => {
                                    const isSelected = hour === value;
                                    const isUnavailable = omittedHours.includes(hour);

                                    if (isUnavailable) {
                                        return (
                                            <div
                                                key={hour}
                                                className={`cursor-not-allowed px-3 py-2 flex justify-between items-center hover:bg-gray-100 ${isSelected ? "bg-gray-50" : ""}`}
                                            >
                                                <span className="line-through text-gray-300">{formatHour(hour)}</span>
                                                {isSelected && <FaCheck className="text-blue-500 size-3" />}
                                            </div>
                                        )
                                    };

                                    return (
                                        <div
                                            key={hour}
                                            onClick={() => {
                                                onChange(hour);
                                                setOpen(false);
                                            }}
                                            className={`cursor-pointer px-3 py-2 flex justify-between items-center hover:bg-gray-100 ${isSelected ? "bg-gray-50" : ""}`}
                                        >
                                            <span>{formatHour(hour)}</span>
                                            {isSelected && <FaCheck className="text-blue-500 size-3" />}
                                        </div>
                                    )
                                })
                            }
                        </div>
                    )
                }
            </button>
        </div>
    )
}
