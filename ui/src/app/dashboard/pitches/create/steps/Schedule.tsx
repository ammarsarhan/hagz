import { useState } from "react";
import HourSlider from "@/app/components/dashboard/Slider";
import useFormContext from "@/app/context/useFormContext";
import { BiPlus } from "react-icons/bi";
import { IoIosClose } from "react-icons/io";
import { FaArrowRight } from "react-icons/fa6";
import z from "zod";
import { PitchScheduleItem, PitchType } from "@/app/utils/types/pitch";

export const scheduleSchema = z.array(
  z.object({

  })
);

const slots = [
    { start: "00:00", end: "01:00" },
    { start: "01:00", end: "02:00" },
    { start: "02:00", end: "03:00" },
    { start: "03:00", end: "04:00" },
    { start: "04:00", end: "05:00" },
    { start: "05:00", end: "06:00" },
    { start: "06:00", end: "07:00" },
    { start: "07:00", end: "08:00" },
    { start: "08:00", end: "09:00" },
    { start: "09:00", end: "10:00" },
    { start: "10:00", end: "11:00" },
    { start: "11:00", end: "12:00" },
    { start: "12:00", end: "13:00" },
    { start: "13:00", end: "14:00" },
    { start: "14:00", end: "15:00" },
    { start: "15:00", end: "16:00" },
    { start: "16:00", end: "17:00" },
    { start: "17:00", end: "18:00" },
    { start: "18:00", end: "19:00" },
    { start: "19:00", end: "20:00" },
    { start: "20:00", end: "21:00" },
    { start: "21:00", end: "22:00" },
    { start: "22:00", end: "23:00" },
    { start: "23:00", end: "23:59" }
];

const HoursModal = ({ 
    index, 
    isOpen, 
    onClose 
} : { 
    index: number, 
    isOpen: "PEAK" | "OFFPEAK" | null, 
    onClose: () => void 
}) => {
    const { formData, setFormData } = useFormContext();
    
    const activeSchedule = formData.schedule[index] as PitchScheduleItem;

    const openTime = activeSchedule.openTime;
    const closeTime = activeSchedule.closeTime;

    const handlePeakHour = (value: number) => {
        const updated = activeSchedule;
        const exists = activeSchedule.peakHours.includes(value);

        if (exists) {
            const target = updated.peakHours.findIndex(slot => slot === value);
            
            updated.peakHours.splice(target, 1);
            
            setFormData((prev: PitchType) => ({
                ...prev,
                schedule: prev.schedule.map((item: PitchScheduleItem) => item.dayOfWeek === index ? updated : item)
            }));

            return;
        };
        
        updated.peakHours.push(value);       

        setFormData((prev: PitchType) => ({
            ...prev,
            schedule: prev.schedule.map((item: PitchScheduleItem) => item.dayOfWeek === index ? updated : item)
        }));
    };

    const handleOffPeakHour = (value: number) => {
        const updated = activeSchedule;
        const exists = activeSchedule.offPeakHours.includes(value);

        if (exists) {
            const target = updated.offPeakHours.findIndex(slot => slot === value);
            
            updated.offPeakHours.splice(target, 1);
            
            setFormData((prev: PitchType) => ({
                ...prev,
                schedule: prev.schedule.map((item: PitchScheduleItem) => item.dayOfWeek === index ? updated : item)
            }));

            return;
        };
        
        updated.offPeakHours.push(value);       

        setFormData((prev: PitchType) => ({
            ...prev,
            schedule: prev.schedule.map((item: PitchScheduleItem) => item.dayOfWeek === index ? updated : item)
        }));
    };

    if (!isOpen) return null;

    const openSlots = slots.slice(openTime, closeTime);

    const isPeak = isOpen == "PEAK";

    const title = isPeak ? "Select Peak Hours" : "Select Offpeak Hours";
    const description = isPeak ? "Select the hours you want the peak hour surcharge to apply to. Slots can not overlap with discounted hours." : "Select the hours you want the off-peak hour discount to apply to. Slots can not overlap with peak hours.";

    return (
        <div className="fixed top-0 left-0 flex items-center justify-center w-screen h-screen z-99 bg-black/50" onClick={onClose}>
            <div className="flex flex-col gap-y-4 gap-x-4 bg-gray-50 rounded-md p-6 m-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-x-8 max-w-108">
                    <div className="flex-1 flex flex-col gap-y-0.5 mt-1">
                        <h2 className="text-sm font-medium">{title}</h2>
                        <p className="text-[0.8125rem] text-gray-500">{description}</p>
                    </div>
                    <button className="flex-shrink-0 hover:text-gray-600 cursor-pointer" type="button" onClick={onClose}>
                        <IoIosClose className="size-6"/>
                    </button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-3 my-2 bg-white border-[1px] border-gray-300 p-4 rounded-md max-w-108">
                    {
                        openSlots.map((slot, index) => {
                            const includesPeak = activeSchedule.peakHours.includes(index);
                            const includesOffPeak = activeSchedule.offPeakHours.includes(index);

                            const isSelectable = (isPeak && !includesOffPeak) || (!isPeak && !includesPeak);
                            const isSelected = (isPeak && includesPeak) || (!isPeak && includesOffPeak);

                            return (
                                <button 
                                    disabled={!isSelectable}
                                    onClick={() => isPeak ? handlePeakHour(index) : handleOffPeakHour(index)} 
                                    key={index} 
                                    type="button" 
                                    className={`
                                        ${isSelected ? 'bg-blue-100 text-blue-800 border-transparent' : 'border-gray-200'}
                                        ${!isSelectable ? "bg-gray-100 border-gray-100! text-gray-600 cursor-not-allowed" : "cursor-pointer"}
                                        flex items-center gap-x-2 transition-colors rounded-md border-[1px] px-3 py-1.5
                                    `}
                                >
                                    <span className="text-[0.8125rem]">{slot.start}</span>
                                    <FaArrowRight className="size-2"/>
                                    <span className="text-[0.8125rem]">{slot.end}</span>
                                </button>
                            )
                        })
                    }
                </div>
            </div>
        </div>
    )
};

export default function Schedule() {
    const { formData, setFormData } = useFormContext();
    const [currentIndex, setCurrentIndex] = useState(0);

    const [isHoursModalOpen, setIsHoursModalOpen] = useState<"PEAK" | "OFFPEAK" | null>(null);

    const activeSchedule = formData.schedule[currentIndex];

    const openTime = activeSchedule.openTime;
    const closeTime = activeSchedule.closeTime

    const isClosed = openTime == 0 && closeTime == 0;

    const days = [
        "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
    ];

    const handleSetOperatingHours = (hours: [number, number]) => {
        const openingHour = hours[0];
        const closingHour = hours[1];

        const schedule = formData.schedule;

        schedule[currentIndex] = {
            ...schedule[currentIndex],
            openTime: openingHour,
            closeTime: closingHour
        };

        setFormData(
            {
                ...formData,
                schedule
            }
        );
    };

    const handleCopySchedule = () => {
        const schedule = Array.from({ length: 7 }).map((_, i) => {
            return {
                dayOfWeek: i,
                openTime: activeSchedule.openTime,
                closeTime: activeSchedule.closeTime,
                peakHours: activeSchedule.peakHours,
                offPeakHours: activeSchedule.offPeakHours
            };
        });

        setFormData(
            {
                ...formData,
                schedule
            }
        );
    };
    
    return (
        <>
            <HoursModal 
                isOpen={isHoursModalOpen} 
                onClose={() => setIsHoursModalOpen(null)}
                index={currentIndex}
            />
            <div className="flex flex-col gap-y-2">
                <div className="flex items-center justify-between gap-x-32">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        {
                            days.map((day, index) => {
                                const active = index === currentIndex;

                                return (
                                    <button 
                                        key={index} 
                                        className={`text-[0.8125rem] px-4 py-2 rounded-full border-[1px] bg-gray-50 hover:bg-white transition-colors border-gray-200 cursor-pointer hidden md:inline ${active ? "border-blue-700! text-blue-800 bg-white" : ""}`} 
                                        onClick={() => setCurrentIndex(index)}
                                        type="button"
                                    >
                                        {day}
                                    </button>
                                )
                            })
                        }
                    </div>
                    <button className="text-blue-700 hover:underline cursor-pointer" type="button" onClick={handleCopySchedule}>
                        <span className="text-[0.8125rem]">Copy Schedule</span>
                    </button>
                </div>
                <div className="flex items-start gap-x-4 my-4">
                    <div className="w-full">
                        <HourSlider 
                            value={[activeSchedule.openTime, activeSchedule.closeTime]} 
                            onChange={handleSetOperatingHours} 
                            label="Open/Close Hours" 
                            description="Select the hours during which your pitch operates."
                            index={currentIndex}
                            required
                        />
                    </div>
                </div>
                {
                    (activeSchedule.openTime != 0 || activeSchedule.closeTime != 0) &&
                    <div className="flex items-start gap-x-4 my-4">
                        <div className="flex flex-col gap-y-2 w-[calc(100%-0.5rem)]">
                            <label>
                                Peak Hours
                                <span className="text-red-500 ml-0.5">*</span>
                            </label>
                            <div className="flex flex-col gap-y-2 items-start">
                                {
                                    activeSchedule.peakHours.length > 0 &&
                                    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                                        {
                                            activeSchedule.peakHours.map((value: number, index: number) => {
                                                return (
                                                    <li key={index} className="text-[0.8125rem] flex gap-x-4 items-center text-nowrap">
                                                        {
                                                            index != 0 &&
                                                            <div className="size-1 rounded-full bg-gray-400"></div>
                                                        }
                                                        <div className="flex items-center gap-x-2">
                                                            <span>{slots[value].start}</span>
                                                            <FaArrowRight className="size-2"/>
                                                            <span>{slots[value].end}</span>
                                                        </div>
                                                    </li>
                                                )
                                            })
                                        }
                                    </ul>
                                }
                                <button 
                                    disabled={isClosed}
                                    onClick={() => setIsHoursModalOpen("PEAK")} 
                                    type="button" 
                                    className={`flex items-center justify-center gap-x-1.5 transition-colors my-1 ${isClosed ? "cursor-not-allowed" : "cursor-pointer"} text-blue-700 hover:underline`}
                                >
                                    {
                                        activeSchedule.peakHours.length <= 0 &&
                                        <BiPlus className="size-3.5"/> 
                                    }
                                    <span className="text-[0.8rem]">
                                        {
                                            activeSchedule.peakHours.length <= 0 ?
                                            "Add Peak Hours" :
                                            "Edit Hours"
                                        }
                                    </span>
                                </button>
                            </div>
                            <p className="text-gray-500 text-xs">Which hours the peak hour surcharge percentage applies to.</p>
                        </div>
                        <div className="flex flex-col gap-y-2 w-[calc(100%-0.5rem)]">
                            <label>
                                Off-peak Hours
                                <span className="text-red-500 ml-0.5">*</span>
                            </label>
                            <div className="flex flex-col gap-y-2 items-start">
                                {
                                    activeSchedule.offPeakHours.length > 0 &&
                                    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                                        {
                                            activeSchedule.offPeakHours.map((value: number, index: number) => {
                                                return (
                                                    <li key={index} className="text-[0.8125rem] flex gap-x-4 items-center text-nowrap">
                                                        {
                                                            index != 0 &&
                                                            <div className="size-1 rounded-full bg-gray-400"></div>
                                                        }
                                                        <div className="flex items-center gap-x-2">
                                                            <span>{slots[value].start}</span>
                                                            <FaArrowRight className="size-2"/>
                                                            <span>{slots[value].end}</span>
                                                        </div>
                                                    </li>
                                                )
                                            })
                                        }
                                    </ul>
                                }
                                <button 
                                    disabled={isClosed}
                                    onClick={() => setIsHoursModalOpen("OFFPEAK")} 
                                    type="button" 
                                    className={`flex items-center justify-center gap-x-1.5 transition-colors my-1 ${isClosed ? "cursor-not-allowed" : "cursor-pointer"} text-blue-700 hover:underline`}
                                >
                                    {
                                        activeSchedule.offPeakHours.length <= 0 &&
                                        <BiPlus className="size-3.5"/> 
                                    }
                                    <span className="text-[0.8rem]">
                                        {
                                            activeSchedule.offPeakHours.length <= 0 ?
                                            "Add Discount Hours" :
                                            "Edit Hours"
                                        }
                                    </span>
                                </button>
                            </div>
                            <p className="text-gray-500 text-xs">Which hours the off-peak hour discount percentage applies to.</p>
                        </div>
                    </div>
                }
            </div>
        </>
    )
}
