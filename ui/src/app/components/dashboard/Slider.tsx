"use client";

import useFormContext from "@/app/context/useFormContext";
import { formatHour } from "@/app/utils/date";
import { PitchScheduleItem, PitchType } from "@/app/utils/types/pitch";
import { FaArrowRight } from "react-icons/fa6";

type SliderProps = {
    label: string;
    value: [number, number];
    onChange: (value: [number, number]) => void;
    placeholder?: string; // not used but for API consistency
    description?: string;
    required?: boolean;
    className?: string;
    index: number;
    error?: string;
};

export default function HourSlider({
    label,
    value,
    onChange,
    description,
    required = false,
    error,
    index,
    className = "",
    ...props
}: SliderProps) {
    const [minVal, maxVal] = value;
    const { formData, setFormData } = useFormContext();

    const format = (h: number) => h.toString().padStart(2, "0") + ":00";

    const handleChange = (idx: 0 | 1, newVal: number) => {
        if (idx === 0) {
            onChange([Math.min(newVal, maxVal - 1), maxVal]);
        } else {
            onChange([minVal, Math.max(newVal, minVal + 1)]);
        };
    };
    
    const handleClearSchedule = () => {
        const updated = formData.schedule[index];

        updated.openTime = 0;
        updated.closeTime = 0;
        updated.peakHours = [];
        updated.offPeakHours = [];

        setFormData((prev: PitchType) => ({
            ...prev,
            schedule: prev.schedule.map((item: PitchScheduleItem) => item.dayOfWeek === index ? updated : item)
        }));
    };

    const isClosed = minVal === 0 && maxVal === 0;

    return (
        <div className={`flex flex-col w-full ${className}`} {...props}>
            <div className="flex flex-col gap-y-4 w-full">
                <div className="flex items-start justify-between gap-x-32">
                    <div className="flex flex-col gap-y-0.5">
                        <label className="font-medium">
                            {label}
                            {required && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                        {!error && description && (
                            <p className="text-gray-500 text-[0.8125rem]">{description}</p>
                        )}
                    </div>
                    {
                        !isClosed &&
                        <button type="button" className="px-3 py-1.5 rounded-md border-[1px] border-red-600 text-red-600 text-xs hover:bg-red-50 transition-colors cursor-pointer" onClick={handleClearSchedule}>
                            <span>Close day</span>
                        </button>
                    }
                </div>
                <div className="flex flex-col gap-y-6">
                    <div className="flex items-center justify-center gap-x-4 text-base font-semibold text-center">
                        {
                            isClosed ?
                            <div className="flex flex-col items-center gap-y-0.5">
                                <span>Closed</span>
                                <span className="text-[0.8rem] font-normal text-gray-500">Drag the slider to select operational hours for this day.</span>
                            </div> :
                            <>
                                {
                                    minVal === 0 && maxVal === 24 ?
                                    <div className="flex flex-col items-center gap-y-0.5">
                                        <span>Open Full Day</span>
                                        <span className="text-[0.8rem] font-normal text-gray-500">Pitch is operational, active, and can service customers for the full 24 hours.</span>
                                    </div> :
                                    <div className="flex flex-col items-center gap-y-0.5">
                                        <div className="flex items-center gap-x-3">
                                            <span>{format(minVal)}</span>
                                            <FaArrowRight className="size-3"/>
                                            <span>{format(maxVal)}</span>
                                        </div>
                                        <span className="text-[0.8rem] font-normal text-gray-500">Pitch is operational from {formatHour(minVal, true)} to {formatHour(maxVal, true)}.</span>
                                    </div>
                                }
                            </>
                        }
                    </div>
                    <div className="relative flex items-center justify-center w-full">
                        <div className="absolute top-1/2 h-[3px] w-full -translate-y-1/2 rounded-md bg-gray-200"/>
                        <div
                            className={`absolute top-1/2 h-[3px] rounded-md -translate-y-1/2 ${
                                error ? "bg-red-500" : "bg-blue-700"
                            }`}
                            style={{
                                left: `${(minVal / 24) * 100}%`,
                                right: `${100 - (maxVal / 24) * 100}%`,
                            }}
                        />
                        <input
                            type="range"
                            min={0}
                            max={24}
                            step={1}
                            value={minVal}
                            onChange={(e) => handleChange(0, Number(e.target.value))}
                            className="absolute w-full appearance-none bg-transparent pointer-events-none"
                        />
                        <input
                            type="range"
                            min={0}
                            max={24}
                            step={1}
                            value={maxVal}
                            onChange={(e) => handleChange(1, Number(e.target.value))}
                            className="absolute w-full appearance-none bg-transparent pointer-events-none"
                        />
                    </div>
                    <div className="flex items-center justify-between text-[0.65rem] text-gray-500">
                        {
                            Array.from({ length: 25 }, (_, i) => {
                                if (i === 24) {
                                    return (
                                        <span key={i}>
                                            00:00 (+1)
                                        </span>
                                    )
                                }

                                if (i % 6 === 0) {
                                    return (
                                        <span key={i} className="text-center">
                                            {i.toString().padStart(2, "0")}:00
                                        </span>
                                    )
                                };

                                return null;
                            })
                        }
                    </div>
                </div>
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>
    );
}
