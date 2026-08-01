import { useMemo, useState } from "react";
import { useCreateBooking } from "@/context/forms/CreateBookingContext";
import { useRequiredPitch } from "@/context/PitchContext";
import { useGroundConfig } from "@/lib/hooks/useGroundConfig";
import cn from "@/lib/cn";
import { IconChevronLeft } from "@tabler/icons-react-native";
import { router } from "expo-router";
import {
    addDays,
    addHours,
    eachDayOfInterval,
    endOfDay,
    endOfMonth,
    endOfWeek,
    format,
    formatDate,
    getDay,
    isAfter,
    isBefore,
    isSameDay,
    isSameMonth,
    startOfDay,
    startOfMonth,
    startOfWeek,
} from "date-fns";
import { Pressable, View, Text, ActivityIndicator } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useGroundSlots } from "@/lib/hooks/useGroundSlots";
import { GroundDaySlot } from "@/lib/types/ground";

interface DateRange {
    start: Date;
    end: Date | null;
}

interface SelectedRange {
    startIndex: number;
    endIndex: number;
}

interface MonthSectionProps {
    month: Date;
    dateRange: DateRange;
    minDate: Date;
    maxDate: Date;
    scheduleMap: Map<number, boolean>;
    onDayPress: (day: Date) => void;
}

function MonthSection({ month, dateRange, minDate, maxDate, scheduleMap, onDayPress }: MonthSectionProps) {
    const today = new Date();

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

    const isInRange = (day: Date) =>
        isSameDay(day, dateRange.start) || (dateRange.end !== null && isSameDay(day, dateRange.end));

    return (
        <View className="mb-8">
            <Text className="text-base font-medium px-2 mb-4">{format(month, "MMMM yyyy")}</Text>
            <View className="gap-y-6">
                {
                    weeks.map((week, index) => (
                        <View key={index} className="flex-row items-center justify-between">
                            {
                                week.map((day) => {
                                    const weekday = getDay(day) + 1;
                                    const isInactiveWeekday = !scheduleMap.get(weekday);
                                    const inCurrentMonth = isSameMonth(day, month);

                                    if (!inCurrentMonth) {
                                        return <View key={day.toISOString()} className="w-10" />;
                                    }

                                    const isSelected = isInRange(day);
                                    const isToday = isSameDay(day, today);
                                    const isDisabled =
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
                                                        isSelected
                                                            ? "text-white"
                                                            : isDisabled
                                                            ? "text-gray-300"
                                                            : "text-black",
                                                        (isSelected || isToday) && "text-sm font-medium",
                                                    )}
                                                >
                                                    {format(day, "d")}
                                                </Text>
                                            </View>
                                        </Pressable>
                                    );
                                })
                            }
                        </View>
                    ))
                }
            </View>
        </View>
    );
}

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

    // Reset date range start to startOfDay(minDate) when minDate is calculated from settings
    useMemo(() => {
        if (settings) {
            setDateRange(prev => ({ ...prev, start: startOfDay(minDate) }));
        }
    }, [minDate, settings]);

    const handleDayPress = (day: Date) => {
        setDateRange((prev) => {
            if (prev.end === null && isSameDay(addDays(prev.start, 1), day)) {
                return { start: prev.start, end: day };
            };

            if (prev.end !== null && (isSameDay(day, prev.end) || isSameDay(day, prev.start))) {
                return { start: day, end: null };
            };

            if (isSameDay(day, prev.start)) {
                return prev;
            };

            return { start: day, end: null };
        });
    };

    const scheduleMap = useMemo(() => {
        return new Map(
            schedule?.map((item) => [item.dayOfWeek, item.isActive]) ?? []
        );
    }, [schedule]);

    const targetMode = dateRange.end !== null ? "MIDNIGHT" : "DAY";
    const { data, isLoading: isSlotsLoading } = useGroundSlots(pitch.id, state.groundId!, targetMode, dateRange.start);

    const renderSlots = () => {
        if (isSlotsLoading) {
            return (
                <View className="py-8 items-center justify-center">
                    <ActivityIndicator />
                </View> 
            )
        };

        if (!data || data.slots.length === 0) {
            return (
            <View className="py-8 items-center justify-center">
                <Text className="text-gray-500">No available slots for this day</Text>
            </View>
            );
        };

        let slots = data.slots as GroundDaySlot[];

        const now = new Date();
        const minimumAllowedTime = settings ? addHours(now, settings.minimumWindow) : now;

        slots = slots.filter((slot) => {
            const slotDate = new Date(slot.startsAt);
            return isAfter(slotDate, minimumAllowedTime) || isSameDay(slotDate, minimumAllowedTime);
        });

        if (slots.length === 0) {
            return (
                <View className="py-8 items-center justify-center">
                    <Text className="text-gray-500">No available slots for this day</Text>
                </View>
            );
        }

        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="px-4 py-8 gap-x-3"
            >
                {
                    slots.map((slot) => {
                        const d = new Date(slot.startsAt);
                        const isDisabled = slot.status !== "AVAILABLE";

                        return (
                            <Pressable key={slot.id} className={cn("px-5 py-3 rounded-full border border-gray-200", isDisabled && "opacity-30")}>
                                <Text>{format(d, "hh:mm a")}</Text>
                            </Pressable>
                        );
                    })
                }
            </ScrollView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
            <ScrollView
                className="flex-1"
                contentContainerClassName="p-6"
                contentContainerStyle={{ paddingBottom: 180 + insets.bottom }}
            >
                <View className="flex-row items-center justify-between mb-3">
                    <Pressable
                        className="size-11 items-center justify-center rounded-full bg-gray-100"
                        onPress={router.back}
                    >
                        <IconChevronLeft size={18} />
                    </Pressable>
                </View>
                <View className="gap-y-2 py-2 mb-6">
                    <Text className="text-3xl font-semibold">Choose slots</Text>
                    <Text className="text-gray-500">
                        Select a day, or two consecutive days for slots that run past midnight.
                    </Text>
                    {/* {settings && (
                        <Text className="text-gray-400 text-sm">
                            {settings.minimumDuration}–{settings.maximumDuration} hour(s) per booking · booked at
                            least {settings.minimumWindow}h in advance
                        </Text>
                    )} */}
                </View>
                {
                    isLoading ? 
                        <View className="py-10 flex-1 items-center justify-center">
                            <ActivityIndicator />
                        </View>
                    : 
                        <>
                            <View className="flex-row items-center justify-between pb-8">
                                {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => {
                                    const item = schedule?.find(schedule => schedule.dayOfWeek === index + 1)!;

                                    return (
                                        <Text
                                            key={index}
                                            className={`w-10 text-center ${cn(
                                                item.isActive ? "text-gray-500" : "text-gray-100"
                                            )}`}
                                        >
                                            {label}
                                        </Text>
                                    );
                                })}
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
