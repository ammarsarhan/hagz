"use client";

import { AnimatePresence, motion } from "framer-motion";

import Toggle from "@/app/components/base/Toggle";
import Dropdown from "@/app/components/dashboard/Dropdown";
import { hours, TimeRange } from "@/app/utils/schedule";

import { FaChevronDown, FaCopy, FaPlus, FaTrash } from "react-icons/fa6";

function getFilteredOptions(ranges: TimeRange[], index: number) {
    const prev = ranges[index - 1];
    const next = ranges[index + 1];
    const [currentStart, currentEnd] = ranges[index];

    const minStart = prev ? prev[1] : 0;
    const maxEnd = next ? next[0] : 24;

    const startOptions = hours.filter((h) => {
        const v = parseInt(h.value);
        return v >= minStart && v < currentEnd;
    });

    const endOptions = hours.filter((h) => {
        const v = parseInt(h.value);
        return v > currentStart && v <= maxEnd;
    });

    return { startOptions, endOptions };
};

interface ScheduleItemProps {
    day: string;
    isActive: boolean;
    onToggle: () => void;
    ranges: TimeRange[];
    setRanges: (value: TimeRange[]) => void;
    isSelected: boolean;
    onClose: () => void;
    onCopyToAll?: (ranges: TimeRange[]) => void;
}

export default function ScheduleItem({ day, isActive, onToggle, ranges, setRanges, isSelected, onClose, onCopyToAll }: ScheduleItemProps) {
    const handleClose = () => {
        if (!isActive) return;
        onClose();
    };

    const handlePickStart = (index: number, value: string) => {
        const hour = parseInt(value);
        setRanges(ranges.map((r, i): TimeRange => (i !== index ? r : [hour, r[1]])));
    };

    const handlePickEnd = (index: number, value: string) => {
        const hour = parseInt(value);
        setRanges(ranges.map((r, i): TimeRange => (i !== index ? r : [r[0], hour])));
    };

    const handleAddRange = (e: React.MouseEvent) => {
        e.stopPropagation();
        const last = ranges[ranges.length - 1];
        const newStart = last[1];
        const newEnd = Math.min(newStart + 1, 24);
        if (newStart >= 23) return;
        setRanges([...ranges, [newStart + 1, newEnd + 1 > 24 ? 24 : newEnd + 1]]);
    };

    const handleRemoveRange = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        if (ranges.length <= 1) return;
        setRanges(ranges.filter((_, i) => i !== index));
    };

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        onCopyToAll?.(ranges);
    };

    const lastEnd = ranges[ranges.length - 1]?.[1] ?? 24;
    const canAddRange = lastEnd < 23;

    return (
        <AnimatePresence mode="wait">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`p-3 border rounded-md cursor-pointer ${isSelected ? "border-gray-400" : "border-gray-200 hover:bg-gray-50"} transition-all`}
                onClick={handleClose}
            >
                <motion.div className="flex items-center justify-between">
                    <div className="flex items-center gap-x-3 min-w-0">
                        <Toggle
                            isOpen={isActive}
                            setIsOpen={(e?: React.MouseEvent) => {
                                e?.stopPropagation();
                                onToggle();
                            }}
                            variant="primary"
                        />
                        <span className="text-sm font-medium shrink-0">{day}</span>
                        {isActive && !isSelected && ranges.length > 0 && (
                            <span className="text-xs text-gray-400 truncate">
                                &nbsp;·&nbsp;{ranges.map(([s, e]) => `${s}:00 - ${e}:00`).join("  ·  ")}
                            </span>
                        )}
                    </div>
                    <FaChevronDown
                        className={`size-3.5 shrink-0 transition-all ${isActive ? "opacity-100" : "opacity-0"} ${isSelected ? "rotate-180" : "rotate-0"}`}
                    />
                </motion.div>
                {
                    isSelected && isActive &&
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mt-3 flex flex-col gap-y-2 text-xxs"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {
                            ranges.map((range, index) => {
                                const { startOptions, endOptions } = getFilteredOptions(ranges, index);

                                return (
                                    <div key={index} className="flex items-center gap-x-4">
                                        <div className="flex items-center gap-x-4 flex-1">
                                            <Dropdown
                                                placeholder="Select start"
                                                value={`${range[0]}`}
                                                onChange={(value) => handlePickStart(index, value)}
                                                options={startOptions}
                                                className="flex-1"
                                            />
                                            <span className="text-gray-400 shrink-0">to</span>
                                            <Dropdown
                                                placeholder="Select end"
                                                value={`${range[1]}`}
                                                onChange={(value) => handlePickEnd(index, value)}
                                                options={endOptions}
                                                className="flex-1"
                                            />
                                        </div>
                                        <div className="flex items-center gap-x-1 shrink-0">
                                            {
                                                index === 0 ?
                                                    <>
                                                        <button
                                                            onClick={handleAddRange}
                                                            title="Add time range"
                                                            disabled={!canAddRange}
                                                            className="flex-center size-8 rounded-full bg-transparent hover:bg-gray-200/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                        >
                                                            <FaPlus className="size-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={handleCopy}
                                                            title="Copy to all days"
                                                            className="flex-center size-8 rounded-full bg-transparent hover:bg-gray-200/80 transition-all"
                                                        >
                                                            <FaCopy className="size-3.5" />
                                                        </button>
                                                    </>
                                                :
                                                <button
                                                    onClick={(e) => handleRemoveRange(e, index)}
                                                    title="Remove time range"
                                                    className="flex-center size-8 rounded-full bg-transparent hover:bg-gray-200/80 transition-all"
                                                >
                                                    <FaTrash className="size-3.5" />
                                                </button>
                                            }
                                        </div>
                                    </div>
                                )
                            })
                        }
                    </motion.div>
                }
            </motion.div>
        </AnimatePresence>
    );
}