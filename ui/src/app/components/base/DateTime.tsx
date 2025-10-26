import { eachDayOfInterval, endOfMonth, format, getDay, getMonth, getYear, isToday, startOfMonth } from "date-fns"
import { useEffect, useMemo, useRef, useState } from "react"
import { BiChevronLeft, BiChevronRight } from "react-icons/bi"
import { FaChevronDown, FaRegCalendarDays } from "react-icons/fa6"
import { IoIosClose } from "react-icons/io"

export function BookingSlotPicker() {
    return (
        <div>

        </div>
    )
}

export function TimePicker() {
    return (
        <div>

        </div>
    )
}

interface DatePickerProps {
    value: Date
}

const getNextAndPreviousLabels = (index: number, date: Date) => {
    const year = getYear(date);
    let startIndex = index - 6 > 0 ? index - 6 : (index - 6) + 12;
    const labels: { month: number, year: number }[] = [];

    for (let i = 0; i < 6; i++) {
        let value = {
            month: i + startIndex,
            year: year
        };
        
        if (value.month > 11) {
            const offset = 6 - index;
            value = {
                month: i - offset,
                year: year - 1
            };
        };

        labels.push(value);
    };

    labels.push({ month: index, year: year });

    startIndex = labels[labels.length - 1].month + 1;

    for (let i = 0; i < 6; i++) {
        let value = {
            month: startIndex + i,
            year: year
        };
        
        if (value.month > 11) {
            const offset = 11 - index;
            value = {
                month: i - offset,
                year: year + 1
            };
        };

        labels.push(value);
    }

    return labels;
};

export function DatePicker({ value } : DatePickerProps) {
    const now = new Date();

    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(6);

    const label = useMemo(() => {
        return format(value, "MMMM do, yyyy");
    }, [value]);

    const days = ["S", "M", "T", "W", "T", "F", "S"];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    const index = getMonth(now);
    const data = getNextAndPreviousLabels(index, now);

    const labels = data.map(item => ({ 
        month: months[item.month], 
        year: item.year 
    }));

    const previous = () => {
        if (activeIndex > 0) setActiveIndex(prev => prev - 1);
    };

    const next = () => {
         if (activeIndex < labels.length - 1) setActiveIndex(prev => prev + 1);
    };

    return (
        <div className="relative bg-white w-full">
            <button 
                onClick={() => setOpen((prev) => !prev)}
                type="button" 
                className="cursor-pointer w-full border border-gray-200 rounded-md p-2 flex justify-between items-center text-left hover:border-gray-300 focus:ring-2 focus:ring-blue-200"
            >
                <FaRegCalendarDays className="size-3.5 text-gray-700"/>
                <span className="text-[0.775rem]">{label} {isToday(value) && <span className="text-gray-700">(Today)</span>}</span>
                <FaChevronDown className={`text-gray-500 ml-2 size-3 transition-transform ${open ? "rotate-180" : ""}`}/>
            </button>
            {open && (
                <div className="w-screen h-screen fixed top-0 left-0 z-10 bg-black/50" onClick={() => setOpen(false)}>
                    <div className="relative left-1/2 top-1/2 -translate-1/2 max-w-96 w-full bg-white border border-gray-200 rounded-md shadow-lg overflow-auto z-15" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-y-6 border-b-[1px] border-gray-200 px-6 pt-6">
                            <div className="flex items-start justify-between gap-x-16">
                                <div className="flex flex-col gap-y-0.5">
                                    <h1 className="text-[0.85rem] font-medium">Select date</h1>
                                    <span className="text-gray-500 text-xs">Pick a date for the booking to start at.</span>
                                </div>
                                <button className="flex-shrink-0 hover:text-gray-600 cursor-pointer" type="button" onClick={() => console.log("smth")}>
                                    <IoIosClose className="size-6"/>
                                </button>
                            </div>
                            <div className="grid grid-cols-7">
                                {days.map((day, index) => <span key={index} className="text-xs size-8 text-center">{day}</span>)}
                            </div>
                        </div>
                        <div className="flex items-center gap-x-3 p-6">
                            <div className="flex-1 flex flex-col gap-y-4">
                                <h2 className="text-[0.95rem] font-medium">{labels[activeIndex].month}, {labels[activeIndex].year}</h2>

                            </div>
                        </div>
                    </div>
                </div>
                )}
        </div>
    )
}