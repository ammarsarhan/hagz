import { ActionDispatch, useState } from "react";
import { motion } from "framer-motion";

import PricingItem from "@/app/components/dashboard/pitch/create/PricingItem";
import { Ground } from "@/app/utils/types/dashboard";
import { CreateGroundModalAction } from "@/app/components/dashboard/pitch/create/modals/Ground";
import { bitmaskToRanges, days } from "@/app/utils/schedule";

export default function Pricing({ state, dispatch }: { state: Ground; dispatch: ActionDispatch<[action: CreateGroundModalAction]> }) {
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    const handleSelect = (index: number) =>
        setSelectedDay((prev) => (prev === index ? null : index));

    const operatingHours = state.operatingHours.map((mask) => mask !== 0 ? bitmaskToRanges(mask) : []);

    const setPricing = (day: number, hour: number) => {
        const isPeak = (state.peakHours[day] & (1 << hour)) !== 0;
        const isDiscount = (state.discountHours[day] & (1 << hour)) !== 0;

        if (!isPeak && !isDiscount) {
            const updatedPeak = [...state.peakHours];
            updatedPeak[day] |= (1 << hour);

            dispatch({ type: "set", field: "peakHours", value: updatedPeak });
            return;
        }
        
        if (isPeak) {
            const updatedPeak = [...state.peakHours];
            const updatedDiscount = [...state.discountHours];
            
            updatedPeak[day] &= ~(1 << hour);
            updatedDiscount[day] |= (1 << hour);
            
            dispatch({ type: "set", field: "peakHours", value: updatedPeak });
            dispatch({ type: "set", field: "discountHours", value: updatedDiscount });
            return;
        };
        
        if (isDiscount) {
            const updatedPeak = [...state.peakHours];
            const updatedDiscount = [...state.discountHours];

            updatedPeak[day] &= ~(1 << hour);
            updatedDiscount[day] &= ~(1 << hour);

            dispatch({ type: "set", field: "peakHours", value: updatedPeak });
            dispatch({ type: "set", field: "discountHours", value: updatedDiscount });
        };
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="flex items-center gap-x-4 mb-3">
                <div className="flex items-center gap-x-1.75">
                    <div className="size-3 rounded-sm bg-blue-700"></div>
                    <span className="text-xs font-medium">Peak</span>
                </div>
                <div className="flex items-center gap-x-1.75">
                    <div className="size-3 rounded-sm bg-yellow-400"></div>
                    <span className="text-xs font-medium">Discount</span>
                </div>
            </div>
            <div className="w-full flex flex-col gap-y-4">
                {
                    days.map((_, index) => (
                        <PricingItem
                            key={index}
                            day={index}
                            isActive={state.operatingHours[index] !== 0}
                            isSelected={selectedDay === index}
                            operatingHours={operatingHours[index]}
                            peakHours={state.peakHours[index]}
                            discountHours={state.discountHours[index]}
                            setPricing={setPricing}
                            onClose={() => handleSelect(index)}
                        />
                    ))
                }
            </div>
        </motion.div>
    )
}