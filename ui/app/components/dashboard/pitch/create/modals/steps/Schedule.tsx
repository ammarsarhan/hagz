"use client";

import { ActionDispatch, useState } from "react";
import { motion } from "framer-motion";

import ScheduleItem from "@/app/components/dashboard/pitch/create/ScheduleItem";
import { CreateGroundModalAction } from "@/app/components/dashboard/pitch/create/modals/Ground";
import { Ground } from "@/app/utils/types/dashboard";
import { bitmaskToRanges, days, rangesToBitmask, TimeRange } from "@/app/utils/schedule";

export default function Schedule({ state, dispatch }: { state: Ground; dispatch: ActionDispatch<[action: CreateGroundModalAction]> }) {
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [snapshots, setSnapshots] = useState<number[]>(() => [...state.operatingHours]);

    const handleSelect = (index: number) =>
        setSelectedDay((prev) => (prev === index ? null : index));

    const handleToggle = (index: number) => {
        const current = state.operatingHours[index];
        const updated = [...state.operatingHours];

        if (current !== 0) {
            setSnapshots((prev) => {
                const next = [...prev];
                next[index] = current;
                return next;
            });

            updated[index] = 0;
            if (selectedDay === index) setSelectedDay(null);
        } else {
            updated[index] = snapshots[index];
        }

        dispatch({ type: "set", field: "operatingHours", value: updated });
    };

    const ranges = state.operatingHours.map((mask) => mask !== 0 ? bitmaskToRanges(mask) : []);

    const setRanges = (value: TimeRange[], index: number) => {
        const updated = [...state.operatingHours];
        const mask = rangesToBitmask(value);
        updated[index] = mask;

        if (mask !== 0) {
            setSnapshots((prev) => {
                const next = [...prev];
                next[index] = mask;
                return next;
            });
        };
        
        dispatch({ type: "set", field: "operatingHours", value: updated });
    };

    const handleCopyToAll = (source: TimeRange[]) => {
        const mask = rangesToBitmask(source);
        const updated = state.operatingHours.map((current) => current !== 0 ? mask : 0);

        setSnapshots((prev) => prev.map((snap, i) => updated[i] !== 0 ? mask : snap));
        dispatch({ type: "set", field: "operatingHours", value: updated });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col w-full gap-y-4"
        >
            {
                days.map((day, index) => (
                    <ScheduleItem
                        key={index}
                        day={day}
                        isActive={state.operatingHours[index] !== 0}
                        onToggle={() => handleToggle(index)}
                        ranges={ranges[index]}
                        setRanges={(value) => setRanges(value, index)}
                        isSelected={selectedDay === index}
                        onClose={() => handleSelect(index)}
                        onCopyToAll={handleCopyToAll}
                    />
                ))
            }
        </motion.div>
    );
};
