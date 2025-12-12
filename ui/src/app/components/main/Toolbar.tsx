"use client";

import _ from "lodash";
import { ActionDispatch, ReactNode, useEffect, useReducer, useRef, useState } from "react"
import { addDays, differenceInHours, endOfDay, format, getMonth, isAfter, isBefore, isEqual, isWithinInterval, parse, startOfDay } from "date-fns";
import { Amenity, amenities } from "@/app/utils/types/pitch";
import { getNextLabels, resolveMonthGrids } from "@/app/components/base/DateTime";
import { FaCheck, FaChevronDown } from "react-icons/fa6";

type Opt = { value: string; label: string, icon?: ReactNode };

interface ToolbarDropdownProps {
    options: Opt[];
    values: Array<string>;
    label: string;
    field: string;
    dispatch: ActionDispatch<[action: ToolbarAction]>;
    required?: boolean;
    highlight?: boolean;
    className?: string;
};

const ToolbarMultiDropdown = ({ options, values, label, field, dispatch, className, required = false, highlight = false } : ToolbarDropdownProps) => {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const initialRef = useRef(values);

    const isChanged = !_.isEqual(
        values,
        initialRef.current
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const target = e.target.value;
        const isSelected = values.includes(target);

        let newValues: string[];

        if (isSelected) {
            if (required && values.length === 1) return;
            newValues = values.filter(val => val !== target);
        } else {
            newValues = [...values, target];
        };

        const ordered = options
            .map(opt => opt.value)
            .filter(value => newValues.includes(value));

        dispatch({ type: "SET", field, value: ordered });
    };

    return (
        <div className={`relative text-[0.8rem] ${className}`} ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className={`cursor-pointer w-full rounded-full border-[1px] border-gray-200 py-2 px-4 flex justify-between items-center text-left`}
            >
                <span className={`truncate ${highlight && isChanged ? "text-blue-700" : "text-black"}`}>
                    {label}
                </span>
                <FaChevronDown
                    className={`text-gray-500 size-3 transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>
            {
                open &&
                (
                    <div className="absolute mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto z-50">
                        {
                        options.length > 0 ? (
                            options.map((opt) => (
                                <div
                                    key={opt.value}
                                    onClick={() => {
                                        const syntheticEvent = {
                                            target: { value: opt.value },
                                        } as unknown as React.ChangeEvent<HTMLSelectElement>;

                                        onChange?.(syntheticEvent);
                                    }}
                                    className={`cursor-pointer px-3 py-2.5 flex justify-between items-center hover:bg-gray-100 ${values.includes(opt.value) ? "bg-gray-50" : ""}`}
                                >
                                    <div className="flex items-center gap-x-2">
                                        {opt.icon}
                                        <span>{opt.label}</span>
                                    </div>
                                    {values.includes(opt.value) && <FaCheck className="text-blue-500 size-3"/>}
                                </div>
                            ))
                        ) : (
                            <div className="p-2 text-gray-500">No options</div>
                        )}
                    </div>
                )
            }
        </div>
    )
}

interface ToolbarDatePickerProps {
    value: DateRange;
    onChange: (value: DateRange) => void;
    className?: string;
}

const ToolbarDatePicker = ({ value, onChange, className } : ToolbarDatePickerProps) => {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const calendarRef = useRef<HTMLDivElement | null>(null);
    const calendarPositionRef = useRef<number | null>(null);

    const [open, setOpen] = useState(false);
    const now = startOfDay(new Date());

    const label = `${format(value.startDate, "dd/MM/yy")} ${value.endDate ? `- ${format(value.endDate, "dd/MM/yy")}` : ""}`.trim();

    const days = ["S", "M", "T", "W", "T", "F", "S"];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    const data = getNextLabels(now);

    const labels = data.map(item => ({ 
        month: months[item.month],
        year: item.year 
    }));

    const grids = resolveMonthGrids(data);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const calendar = calendarRef.current;
        if (!calendar || !open) return;

        if (calendarPositionRef.current === null) calendar.scrollTop = 0;
        else calendar.scrollTop = calendarPositionRef.current;

        const handleScroll = () => {
            calendarPositionRef.current = calendar.scrollTop;
        };

        calendar.addEventListener("scroll", handleScroll);
        return () => calendar.removeEventListener("scroll", handleScroll);
    }, [open]);

    const handleDayClick = (date: Date) => {
        if (value.endDate) {
            onChange({ startDate: date, endDate: null });
            return;
        };

        // In the case that a startDate has already been picked, we want to select the endDate.
        if (value.startDate && isAfter(date, value.startDate)) {
            onChange({ startDate: value.startDate, endDate: date });
            return;
        };

        // Handle a normal click and set startDate.
        onChange({ startDate: date, endDate: null });
    };

    const isToday = isEqual(value.startDate, now) && !value.endDate;
    const isThisWeek = isEqual(value.startDate, now) && (value.endDate && isEqual(value.endDate, addDays(now, 7)));
    const isNextWeek = isEqual(value.startDate, addDays(now, 7)) && (value.endDate && isEqual(value.endDate, addDays(now, 14)));
    const isThisBiweek = isEqual(value.startDate, now) && (value.endDate && isEqual(value.endDate, addDays(now, 14)));

    return (
        <div className={`relative text-[0.8rem] ${className}`} ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className={`cursor-pointer w-full rounded-full border-[1px] border-gray-200 py-2 px-4 flex justify-between gap-x-3 items-center text-left`}
            >
                <span className="truncate">
                    {label}
                </span>
                <FaChevronDown
                    className={`text-gray-500 size-3 transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>
            {
                open &&
                (
                    <div className="absolute mt-1 w-xl flex bg-white border border-gray-200 rounded-md shadow-lg h-96 overflow-auto z-50">
                        <div className="w-40 border-r-[1px] border-gray-200 py-2">
                            <div className="flex flex-col mt-3">
                                <button 
                                    className={`
                                        p-2 transition-colors border-y-[1px]
                                        ${isToday ? "border-blue-700 text-blue-700 bg-blue-50" : "border-transparent hover:bg-gray-100 cursor-pointer"}
                                    `}
                                    onClick={() => onChange({ startDate: now, endDate: null })}
                                >
                                    Today
                                </button>
                                <button 
                                    className={`
                                        p-2 transition-colors border-y-[1px]
                                        ${isThisWeek ? "border-blue-700 text-blue-700 bg-blue-50" : "border-transparent hover:bg-gray-100 cursor-pointer"}
                                    `}
                                    onClick={() => onChange({ startDate: now, endDate: addDays(now, 7) })}
                                >
                                    This Week
                                </button>
                                <button 
                                    className={`
                                        p-2 transition-colors border-y-[1px]
                                        ${isNextWeek ? "border-blue-700 text-blue-700 bg-blue-50" : "border-transparent hover:bg-gray-100 cursor-pointer"}
                                    `}
                                    onClick={() => onChange({ startDate:  addDays(now, 7), endDate: addDays(now, 14) })}
                                >
                                    Next Week
                                </button>
                                <button 
                                    className={`
                                        p-2 transition-colors border-y-[1px]
                                        ${isThisBiweek ? "border-blue-700 text-blue-700 bg-blue-50" : "border-transparent hover:bg-gray-100 cursor-pointer"}
                                    `}
                                    onClick={() => onChange({ startDate: now, endDate: addDays(now, 14) })}
                                >
                                    Within 2 Weeks
                                </button>
                            </div>
                        </div>
                        <div className="flex-1">
                            <div className="h-14 flex items-center justify-center">
                                <div className="grid grid-cols-7 flex-1 px-6 text-gray-500">
                                    {
                                        days.map((day, index) => {
                                            return (
                                                <span className="w-full text-xs flex items-center justify-center size-8 text-center" key={index}>{day}</span>
                                            )
                                        })
                                    }
                                </div>
                            </div>
                            <div className="flex flex-col gap-y-8 items-center gap-x-3 p-6 h-81.5 overflow-y-scroll" ref={calendarRef}>
                                {
                                    labels.map((label, index) => {
                                        return (
                                            <div className="flex flex-col gap-y-4 w-full" key={index} data-month-index={index}>
                                                <h2 className="text-[0.95rem] font-medium">{label.month}, {label.year}</h2>
                                                <div className="grid grid-cols-7 gap-y-2">
                                                    {
                                                        grids[index].map((day, i) => {
                                                            if (day === null) {
                                                                return <div key={i} className="size-8"></div>
                                                            };
                                                            
                                                            const year = label.year;
                                                            const month = getMonth(parse(label.month, 'MMMM', new Date()));
                                                            const date = new Date(year, month, day);

                                                            const isWithin = value.endDate && isWithinInterval(date, { start: value.startDate, end: value.endDate });
                                                            
                                                            if (isEqual(date, value.startDate)) {
                                                                return (
                                                                    <div className="flex items-center justify-center w-full" key={i}>
                                                                        <button onClick={() => handleDayClick(date)} className="bg-blue-700 text-white rounded-full text-xs size-8 text-center cursor-pointer transition-colors">{day}</button>
                                                                    </div>
                                                                );
                                                            };
                                                            
                                                            if (value.endDate && isEqual(date, value.endDate)) {
                                                                return (
                                                                    <div className="flex items-center justify-center w-full" key={i}>
                                                                        <button onClick={() => handleDayClick(date)} className="border-[1px] border-blue-700 text-blue-700 rounded-full text-xs size-8 text-center cursor-pointer transition-colors">{day}</button>
                                                                    </div>
                                                                );
                                                            }

                                                            if (isWithin) {
                                                                return (
                                                                    <div className="flex items-center justify-center w-full" key={i}>
                                                                        <button onClick={() => handleDayClick(date)} className="bg-blue-100 rounded-full text-xs size-8 text-center cursor-pointer transition-colors">{day}</button>
                                                                    </div>
                                                                )
                                                            }

                                                            if (isBefore(date, now)) {
                                                                return (
                                                                    <div className="flex items-center justify-center w-full" key={i}>
                                                                        <button className="rounded-full text-gray-500 line-through text-xs size-8 text-center">{day}</button>
                                                                    </div>
                                                                )
                                                            }

                                                            if (isEqual(date, now)) {
                                                                return (
                                                                    <div className="flex items-center justify-center w-full" key={i}>
                                                                        <button onClick={() => handleDayClick(date)} className="hover:bg-gray-100 bg-gray-200 rounded-full text-xs size-8 text-center cursor-pointer transition-colors">{day}</button>
                                                                    </div>
                                                                )   
                                                            }

                                                            return (
                                                                <div className="flex items-center justify-center w-full" key={i}>
                                                                    <button onClick={() => handleDayClick(date)} className="hover:bg-gray-100 rounded-full text-xs size-8 text-center cursor-pointer transition-colors">{day}</button>
                                                                </div>
                                                            );
                                                        })
                                                    }
                                                </div>
                                            </div>
                                        )
                                    })
                                }
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    )
};
        
interface ToolbarDurationPickerProps {
    value: number;
    onChange: (value: number) => void;
}

const ToolbarDurationPicker = ({ value, onChange } : ToolbarDurationPickerProps) => {
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

    return (
        <div className="relative text-[0.8rem]" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className={`cursor-pointer w-full rounded-full border-[1px] border-gray-200 py-2 px-4 flex justify-between gap-x-3 items-center text-left`}
            >
                <span className="truncate">
                    {value} Hour{value > 1 ? "s" : ""}
                </span>
                <FaChevronDown
                    className={`text-gray-500 size-3 transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>
            {
                open &&
                (
                    <div className="absolute mt-1 w-60 flex flex-col gap-y-2 p-4 bg-white border border-gray-200 rounded-md shadow-lg overflow-auto z-50">
                        <span className="text-gray-500">Duration (Hours)</span>
                        <div className="w-full relative">
                            <input 
                                type="range" 
                                min="1" 
                                max="5" 
                                step="1" 
                                className="
                                    w-full appearance-none h-1 rounded-lg
                                "
                                style={{
                                    "--percent": `${((value - 1) / 4) * 100}%`,
                                    background: `linear-gradient(to right, #2563eb ${((value - 1) / 4) * 100}%, #e5e7eb ${((value - 1) / 4) * 100}%)`,
                                } as React.CSSProperties}
                                value={value} 
                                onChange={(e) => onChange(parseInt(e.target.value))}
                            />
                            <div className="w-full flex items-center justify-between px-1 mt-1.5 text-gray-500">
                                <span>1</span>
                                <span>2</span>
                                <span>3</span>
                                <span>4</span>
                                <span>5</span>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    )
}

interface DateRange {
    startDate: Date,
    endDate: Date | null
};

export interface ToolbarState {
    amenities: Amenity[];
    groundSizes: Array<"FIVE" | "SEVEN" | "ELEVEN">;
    dateScope: DateRange;
    duration: number;
};

export type ToolbarAction =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { type: "SET"; field: string; value: any }
  | { type: "RESET" }
  | { type: "UPDATE"; payload: Partial<ToolbarState> };

export function createToolbarReducer(state: ToolbarState, action: ToolbarAction): ToolbarState {
    switch (action.type) {
        case "SET":
        return { ...state, [action.field]: action.value };

        case "UPDATE":
        return { ...state, ...action.payload };

        default:
        return state;
    }
};

export default function Toolbar() {
    const now = new Date();

    const hoursUntilMidnight = differenceInHours(endOfDay(now), now);
    const startDate = hoursUntilMidnight <= 2 ? startOfDay(addDays(now, 1)) : startOfDay(now);

    const initialState: ToolbarState = {
        amenities: [],
        groundSizes: ["FIVE", "SEVEN", "ELEVEN"],
        dateScope: { startDate, endDate: null },
        duration: 1,
    };

    const [state, dispatch] = useReducer(createToolbarReducer, initialState);

    const amenityOptions = amenities.flatMap(amenity =>
        amenity.items.map(item => ({
            label: item.label,
            value: item.key,
            icon: item.icon,
        }))
    );

    const groundSizeOptions = [
        { label: "5-a-side", value: "FIVE" },
        { label: "7-a-side", value: "SEVEN" },
        { label: "11-a-side", value: "ELEVEN" },
    ];

    const groundSizeLabels = state.groundSizes.map(item => groundSizeOptions.find(i => i.value === item)!.label).join(", ");

    return (
        <header className="h-16 flex items-center gap-x-4 p-4 border-b-[1px] border-gray-200">
            <ToolbarDatePicker
                value={state.dateScope}
                onChange={(r) => dispatch({ type: "SET", field: "dateScope", value: r })}
            />
            <ToolbarDurationPicker 
                value={state.duration}
                onChange={(duration) => dispatch({ type: "SET", field: "duration", value: duration })}
            />
            <ToolbarMultiDropdown 
                options={groundSizeOptions}
                values={state.groundSizes}
                field="groundSizes"
                dispatch={dispatch}
                label={`${state.groundSizes.length == 3 ? "All Ground Sizes" : groundSizeLabels}`}
                required
                className="w-52"
            />
            <ToolbarMultiDropdown
                options={amenityOptions}
                values={state.amenities}
                field="amenities"
                dispatch={dispatch}
                label={`Amenities (${state.amenities.length})`}
                highlight
                className="w-64"
            />
        </header>
    )
}