import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useCreateBooking } from "@/context/forms/CreateBookingContext";
import { useRequiredPitch } from "@/context/PitchContext";
import { useGroundConfig, useGroundSlots } from "@/lib/hooks";
import cn from "@/lib/cn";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react-native";
import { router } from "expo-router";
import {
    addDays,
    addHours,
    eachDayOfInterval,
    endOfDay,
    endOfMonth,
    endOfWeek,
    format,
    getDay,
    isAfter,
    isBefore,
    isSameDay,
    isSameMonth,
    startOfDay,
    startOfMonth,
    startOfWeek,
} from "date-fns";
import Button from "@/components/shared/Button";
import { Pressable, View, Text, ActivityIndicator } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GroundDaySlot } from "@/lib/types/ground";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

interface DateRange {
    start: Date;
    end: Date | null;
}

interface MonthSectionProps {
    month: Date;
    dateRange: DateRange;
    minDate: Date;
    maxDate: Date;
    scheduleMap: Map<number, boolean>;
    onDayPress: (day: Date) => void;
    locked: boolean;
}

const SlotSkeleton = memo(function SlotSkeleton() {
    const opacity = useSharedValue(0.4);

    useEffect(() => {
        opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View
            pointerEvents="none"
            style={animatedStyle}
            className="px-5 py-3 rounded-full border border-gray-200 bg-gray-200 flex-row items-center gap-x-1.5"
        >
            <Text className="text-transparent">12:00 pm</Text>
            <View className="w-4 h-4" />
            <Text className="text-transparent">12:00 pm</Text>
        </Animated.View>
    );
});

const MonthSection = memo(function MonthSection({
    month,
    dateRange,
    minDate,
    maxDate,
    scheduleMap,
    onDayPress,
    locked,
}: MonthSectionProps) {
    const today = useMemo(() => new Date(), []);

    const weeks = useMemo(() => {
        const start = startOfWeek(startOfMonth(month));
        const end = endOfWeek(endOfMonth(month));
        const days = eachDayOfInterval({ start, end });

        const rows: Date[][] = [];
        for (let i = 0; i < days.length; i += 7) {
            rows.push(days.slice(i, i + 7));
        }
        return rows;
    }, [month]);

    const isInRange = useCallback(
        (day: Date) => isSameDay(day, dateRange.start) || (dateRange.end !== null && isSameDay(day, dateRange.end)),
        [dateRange.start, dateRange.end],
    );

    return (
        <View className={cn("mb-8", locked && "opacity-40")}>
            <Text className="text-base font-medium px-2 mb-4">{format(month, "MMMM yyyy")}</Text>
            <View className="gap-y-6">
                {weeks.map((week, index) => (
                    <View key={index} className="flex-row items-center justify-between">
                        {week.map((day) => {
                            const weekday = getDay(day) + 1;
                            const isInactiveWeekday = !scheduleMap.get(weekday);
                            const inCurrentMonth = isSameMonth(day, month);

                            if (!inCurrentMonth) {
                                return <View key={day.toISOString()} className="w-10" />;
                            }

                            const isSelected = isInRange(day);
                            const isToday = isSameDay(day, today);
                            const isDisabled =
                                locked ||
                                isInactiveWeekday ||
                                isBefore(endOfDay(day), minDate) ||
                                isAfter(startOfDay(day), maxDate);

                            return (
                                <Pressable
                                    key={day.toISOString()}
                                    disabled={isDisabled}
                                    className="w-10 items-center gap-y-2"
                                    onPress={() => onDayPress(day)}
                                >
                                    <View
                                        className={cn(
                                            "rounded-full items-center justify-center size-10",
                                            isSelected ? "bg-primary" : isToday ? "bg-gray-100" : "",
                                        )}
                                    >
                                        <Text
                                            className={cn(
                                                isSelected ? "text-white" : isDisabled ? "text-gray-300" : "text-black",
                                                (isSelected || isToday) && "text-sm font-medium",
                                            )}
                                        >
                                            {format(day, "d")}
                                        </Text>
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>
                ))}
            </View>
        </View>
    );
});

interface SlotButtonProps {
    slot: GroundDaySlot;
    isSelected: boolean;
    isDisabled: boolean;
    onPress: (slot: GroundDaySlot) => void;
}

const SlotButton = memo(function SlotButton({ slot, isSelected, isDisabled, onPress }: SlotButtonProps) {
    const d = useMemo(() => new Date(slot.startsAt), [slot.startsAt]);

    return (
        <Pressable
            disabled={isDisabled}
            onPress={() => onPress(slot)}
            className={cn(
                "px-5 py-3 rounded-full border flex-row items-center gap-x-1.5",
                isSelected ? "border-primary" : "border-gray-200",
                isDisabled && "opacity-30",
            )}
        >
            <Text className={isSelected ? "text-primary" : "text-black"}>{format(d, "hh:mm a")}</Text>
            <IconChevronRight width={16} height={16} color={isSelected ? "#1C04EA" : "#000000"}/>
            <Text className={isSelected ? "text-primary" : "text-black"}>{format(addHours(d, 1), "hh:mm a")}</Text>
        </Pressable>
    );
});

export default function Slots() {
    const insets = useSafeAreaInsets();
    const { pitch } = useRequiredPitch();
    const { state, setState } = useCreateBooking();

    const configQuery = useGroundConfig(pitch.id, state.groundId!);
    const isLoading = !configQuery.data || configQuery.isPending;

    const settings = configQuery.data?.config.settings;
    const schedule = configQuery.data?.config.schedule;

    const { minDate, maxDate, months } = useMemo(() => {
        const now = new Date();
        const min = settings ? addHours(now, settings.minimumWindow) : now;
        const max = settings ? addHours(now, settings.maximumWindow) : now;

        const result: Date[] = [];
        let cursor = startOfMonth(now);
        const lastMonth = startOfMonth(max);

        while (!isAfter(cursor, lastMonth)) {
            result.push(cursor);
            cursor = startOfMonth(addHours(cursor, 24 * 32));
        }

        return { minDate: min, maxDate: max, months: result };
    }, [settings]);

    const [dateRange, setDateRange] = useState<DateRange>(() => ({ start: startOfDay(new Date()), end: null }));

    useMemo(() => {
        if (settings) {
            setDateRange((prev) => ({ ...prev, start: startOfDay(minDate) }));
        }
    }, [minDate, settings]);

    const handleDayPress = useCallback((day: Date) => {
        setDateRange((prev) => {
            if (prev.end === null && isSameDay(addDays(prev.start, 1), day)) {
                return { start: prev.start, end: day };
            }

            if (prev.end !== null && (isSameDay(day, prev.end) || isSameDay(day, prev.start))) {
                return { start: day, end: null };
            }

            if (isSameDay(day, prev.start)) {
                return prev;
            }

            return { start: day, end: null };
        });
    }, []);

    const scheduleMap = useMemo(() => new Map(schedule?.map((item) => [item.dayOfWeek, item.isActive]) ?? []), [schedule]);

    const targetMode = dateRange.end !== null ? "MIDNIGHT" : "DAY";
    const { data, isLoading: isSlotsLoading } = useGroundSlots(pitch.id, state.groundId!, targetMode, dateRange.start);

    const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

    useEffect(() => {
        setSelectedSlots([]);
    }, [dateRange.start, dateRange.end]);

    const slots = useMemo(() => (data?.slots ?? []) as GroundDaySlot[], [data]);

    const slotDurationHours = useMemo(() => {
        if (slots.length < 2) return 1;
        const a = new Date(slots[0].startsAt).getTime();
        const b = new Date(slots[1].startsAt).getTime();
        const diffHours = (b - a) / (1000 * 60 * 60);
        return diffHours > 0 ? diffHours : 1;
    }, [slots]);

    const maxSlotsCount = settings ? Math.max(1, Math.floor(settings.maximumDuration / slotDurationHours)) : 1;

    const isLocked = selectedSlots.length > 0;

    const handleSlotPress = useCallback(
        (slot: GroundDaySlot) => {
            if (slot.status !== "AVAILABLE") return;

            setSelectedSlots((prev) => {
                if (prev.includes(slot.id)) {
                    return [];
                }

                if (prev.length === 0) {
                    return [slot.id];
                }

                const indexOf = (id: string) => slots.findIndex((s) => s.id === id);
                const selectedIndices = prev.map(indexOf).sort((a, b) => a - b);
                const minIndex = selectedIndices[0];
                const maxIndex = selectedIndices[selectedIndices.length - 1];
                const targetIndex = indexOf(slot.id);

                if (targetIndex === -1 || prev.length + 1 > maxSlotsCount) {
                    return prev;
                }

                if (targetIndex === maxIndex + 1) {
                    return [...prev, slot.id];
                }

                if (targetIndex === minIndex - 1) {
                    return [slot.id, ...prev];
                }

                return prev;
            });
        },
        [slots, maxSlotsCount],
    );

    const getSelectedRange = useCallback((): { startTime: Date; endTime: Date } | null => {
        if (selectedSlots.length === 0) return null;

        const selected = slots
            .filter((s) => selectedSlots.includes(s.id))
            .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

        const first = selected[0];
        const last = selected[selected.length - 1];

        const startTime = new Date(first.startsAt);
        const endTime = addHours(new Date(last.startsAt), slotDurationHours);

        return { startTime, endTime };
    }, [selectedSlots, slots, slotDurationHours]);

    const handleNextPress = useCallback(() => {
        const range = getSelectedRange();
        if (!range) return;

        setState((prev) => ({
            ...prev,
            startTime: range.startTime,
            endTime: range.endTime,
        }));

        router.push("/(dashboard)/(tabs)/bookings/modal/payment")
    }, [getSelectedRange, setState]);

    const handleClearSlots = useCallback(() => setSelectedSlots([]), []);

    const slotButtons = useMemo(() => {
        const selectedIndices = selectedSlots
            .map((id) => slots.findIndex((s) => s.id === id))
            .filter((i) => i !== -1)
            .sort((a, b) => a - b);
        const minSelectedIndex = selectedIndices[0];
        const maxSelectedIndex = selectedIndices[selectedIndices.length - 1];

        return slots.map((slot, index) => {
            const isSelected = selectedSlots.includes(slot.id);
            const isUnavailable = slot.status !== "AVAILABLE";

            const isExtendable =
                isLocked &&
                !isSelected &&
                selectedSlots.length + 1 <= maxSlotsCount &&
                (index === maxSelectedIndex + 1 || index === minSelectedIndex - 1);

            const isDisabled = isUnavailable || (isLocked && !isSelected && !isExtendable);

            return { slot, isSelected, isDisabled };
        });
    }, [slots, selectedSlots, isLocked, maxSlotsCount]);

    const renderSlots = () => {
        if (isSlotsLoading) {            
            return (
                <View className="gap-y-6 py-6">
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerClassName="px-4 gap-x-3"
                    >
                        {Array.from({ length: 6 }).map((_, index) => (
                            <SlotSkeleton key={index} />
                        ))}
                    </ScrollView>
                    <View className="flex-row items-center justify-between mx-4 pt-4 border-t border-gray-50">
                        <Button className="bg-gray-100 border-gray-100 py-5 px-8" disabled onPress={() => {}}>
                            <Text className="font-medium">Clear</Text>
                        </Button>
                        <Button className="bg-primary border-primary py-5 px-10" disabled onPress={() => {}}>
                            <Text className="font-medium text-white">Next</Text>
                        </Button>
                    </View>
                </View>
            );
        }

        if (!data || slots.length === 0) {
            return (
                <View className="py-8 items-center justify-center">
                    <Text className="text-gray-500">No available slots for this day</Text>
                </View>
            );
        }

        return (
            <View className="gap-y-6 py-6">
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerClassName="px-4 gap-x-3"
                >
                    {
                        slotButtons.map(({ slot, isSelected, isDisabled }) => (
                            <SlotButton
                                key={slot.id}
                                slot={slot}
                                isSelected={isSelected}
                                isDisabled={isDisabled}
                                onPress={handleSlotPress}
                            />
                        ))
                    }
                </ScrollView>
                <View className="flex-row items-center justify-between mx-4 pt-4 border-t border-gray-50">
                    <Button className="bg-gray-100 border-gray-100 py-5 px-8" onPress={handleClearSlots}>
                        <Text className="font-medium">Clear</Text>
                    </Button>
                    <Button
                        className="bg-primary border-primary py-5 px-10"
                        disabled={selectedSlots.length === 0}
                        onPress={handleNextPress}
                    >
                        <Text className="font-medium text-white">Next</Text>
                    </Button>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
            <ScrollView
                className="flex-1"
                scrollEnabled={selectedSlots.length === 0}
                contentContainerClassName="p-6"
                contentContainerStyle={{ paddingBottom: 180 + insets.bottom }}
            >
                <View className="flex-row items-center justify-between mb-3">
                    <Pressable className="size-11 items-center justify-center rounded-full bg-gray-100" onPress={router.back}>
                        <IconChevronLeft size={18} />
                    </Pressable>
                </View>
                <View className="gap-y-2 py-2 mb-6">
                    <Text className="text-3xl font-semibold">Choose slots</Text>
                    <Text className="text-gray-500">
                        Select a day, or two consecutive days for slots that run past midnight.
                    </Text>
                </View>
                {
                    isLoading ?
                        <View className="py-10 flex-1 items-center justify-center">
                            <ActivityIndicator />
                        </View>
                    :
                        <>
                            <View className={cn("flex-row items-center justify-between pb-8", isLocked && "opacity-40")}>
                                {
                                    ["S", "M", "T", "W", "T", "F", "S"].map((label, index) => {
                                        const isActive = scheduleMap.get(index + 1);

                                        return (
                                            <Text key={index} className={cn("w-10 text-center", isActive ? "text-gray-500" : "text-gray-100")}>
                                                {label}
                                            </Text>
                                        );
                                    })
                                }
                            </View>
                            {
                                months.map((month) => (
                                    <MonthSection
                                        key={month.toISOString()}
                                        month={month}
                                        dateRange={dateRange}
                                        minDate={minDate}
                                        maxDate={maxDate}
                                        scheduleMap={scheduleMap}
                                        onDayPress={handleDayPress}
                                        locked={isLocked}
                                    />
                                ))
                            }
                        </>
                }
            </ScrollView>
            <SafeAreaView
                edges={["bottom"]}
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl border-t border-gray-100"
            >
                {renderSlots()}
            </SafeAreaView>
        </SafeAreaView>
    );
};
