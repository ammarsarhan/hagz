import { AnimatePresence, motion } from "framer-motion";

import { days, flattenRanges, hours, TimeRange } from "@/app/utils/schedule";

import { FaChevronDown } from "react-icons/fa6";

interface PricingItemProps {
    day: number;
    operatingHours: TimeRange[];
    peakHours: number;
    discountHours: number;
    isActive: boolean;
    isSelected: boolean;
    setPricing: (day: number, hour: number) => void;
    onClose: () => void;
}

export default function PricingItem({ day, peakHours, discountHours, isActive, isSelected, operatingHours, setPricing, onClose }: PricingItemProps) {
    const baseStyle = "bg-black text-white hover:bg-black/80";
    const peakStyle = "bg-blue-700 text-white hover:bg-blue-700/90";
    const discountStyle = "bg-yellow-400 text-black hover:bg-yellow-400/80";

    const availableHours = flattenRanges(operatingHours);
    
    const handleClose = () => onClose();
    const handleHourClick = (hour: number) => setPricing(day, hour);
    
    return (
        <AnimatePresence mode="wait">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`p-3 border rounded-md cursor-pointer ${isSelected && isActive ? "border-gray-400" : "border-gray-200 hover:bg-gray-50"} transition-all`}
                onClick={handleClose}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-x-3 min-w-0">
                        <span className="text-sm font-medium shrink-0">{days[day]}</span>
                    </div>
                    <FaChevronDown
                        className={`size-3.5 shrink-0 transition-all ${isActive ? "opacity-100" : "opacity-0"} ${isSelected ? "rotate-180" : "rotate-0"}`}
                    />
                </div>
                {
                    isSelected && isActive &&
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mt-3.5 grid grid-cols-4 gap-x-4 gap-y-2 text-xxs"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {
                            availableHours.map((hour, index) => {
                                const startLabel = `${hours[hour].label.split(":")[0]} ${hours[hour].label.split(" ")[1]}`;
                                const endLabel = `${hours[hour + 1].label.split(":")[0]} ${hours[hour].label.split(" ")[1]}`;

                                const isPeak = (peakHours & (1 << hour)) !== 0;
                                const isDiscount = (discountHours & (1 << hour)) !== 0;

                                return (
                                    <button 
                                        key={index}
                                        className={`relative flex-center gap-x-2 rounded-full p-2 transition-all ${isDiscount ? discountStyle : isPeak ? peakStyle : baseStyle}`}
                                        onClick={() => handleHourClick(hour)}
                                    >
                                        <span className="text-xs">{startLabel} - {endLabel}</span>
                                    </button>
                                )
                            })
                        }
                    </motion.div>
                }
            </motion.div>
        </AnimatePresence>
    );
}