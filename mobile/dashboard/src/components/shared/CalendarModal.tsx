import { useMemo } from "react";
import { IconX } from "@tabler/icons-react-native";
import {
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    formatDate,
    isSameDay,
    isSameMonth,
    startOfMonth,
    startOfWeek,
} from "date-fns";
import { Pressable, View, Text, ActivityIndicator, Modal, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import cn from "@/lib/cn";
import { usePitchAvailability, AvailabilityDay } from "@/lib/hooks/usePitchAvailability";

interface CalendarModalProps {
    visible: boolean;
    onClose: () => void;
    date: Date;
    setDate: (date: Date) => void;
    pitch: string;
    target: string;
}

interface MonthSectionProps {
    month: Date;
    bookedDates: Set<string>;
    selectedDate: Date;
    setDate: (date: Date) => void;
}

// Keys derived from backend dates and calendar-grid days must both be pinned to
// UTC, since the API represents each day as a UTC-midnight instant. Formatting
// with plain date-fns `format()` uses the device's local timezone and can shift
// the key onto the wrong day depending on where the app is running.

const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

function MonthSection({ month, bookedDates, selectedDate, setDate }: MonthSectionProps) {
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

    return (
        <View className="mb-8">
            <Text className="text-base font-medium px-2 mb-4">{format(month, "MMMM yyyy")}</Text>
            <View className="gap-y-6">
                {
                    weeks.map((week, index) => (
                        <View key={index} className="flex-row items-center justify-between">
                            {
                                week.map((day) => {
                                    const inCurrentMonth = isSameMonth(day, month);

                                    if (!inCurrentMonth) {
                                        return <View key={day.toISOString()} className="w-10" />;
                                    }

                                    const isSelected = isSameDay(day, selectedDate);
                                    const isBooked = bookedDates.has(dayKey(day));
                                    const isToday = isSameDay(day, today);

                                    return (
                                        <Pressable
                                            key={day.toISOString()}
                                            className="w-10 items-center gap-y-2"
                                            onPress={() => setDate(day)}
                                        >
                                            <View className={cn("rounded-full items-center justify-center size-10", isSelected ? "bg-primary" : isToday ? "bg-gray-100" : "")}>
                                                <Text className={cn(isSelected ? "text-white" : "text-black", (isSelected || isToday) && "text-sm font-medium")}>
                                                    {format(day, "d")}
                                                </Text>
                                            </View>
                                            <View className={cn("size-1.5 rounded-full", isBooked ? "bg-primary" : "bg-transparent")}/>
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

export default function CalendarModal({ visible, onClose, date, setDate, pitch, target }: CalendarModalProps) {
    const ground = target === "all" ? undefined : target;
    const { data: availability, isLoading } = usePitchAvailability(pitch, ground, visible);

    const bookedDates = useMemo(() => {
        const set = new Set<string>();
        availability?.availability.forEach((day: AvailabilityDay) => {
            if (day.isBooked) {
                set.add(format(new Date(day.date), "yyyy-MM-dd"));
            };
        });

        return set;
    }, [availability]);

    const months = useMemo(() => {
        if (!availability?.availability.length) return [];

        const seen = new Set<string>();
        const result: Date[] = [];

        availability.availability.forEach((day: AvailabilityDay) => {
            const monthStart = startOfMonth(new Date(day.date));
            const key = format(monthStart, "yyyy-MM");

            if (!seen.has(key)) {
                seen.add(key);
                result.push(monthStart);
            };
        });

        return result.sort((a, b) => a.getTime() - b.getTime());
    }, [availability]);

    const handleSelectDate = (newDate: Date) => {
        if (!isSameDay(newDate, date)) {
            setDate(newDate);
        }
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
            allowSwipeDismissal
        >
            <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
                <View className="flex-1 p-6">
                    <View className="flex-row items-center justify-between mb-3">
                        <Pressable
                            className="size-11 items-center justify-center rounded-full bg-gray-100"
                            onPress={onClose}
                        >
                            <IconX size={18} />
                        </Pressable>
                    </View>
                    <View className="gap-y-2 py-2 mb-6">
                        <Text className="text-3xl font-semibold">{formatDate(date, "dd MMMM, yyyy")}</Text>
                        <Text className="text-gray-500">Dots indicate days that have bookings or occupied slots.</Text>
                    </View>
                    <View className="flex-row items-center justify-between pb-8">
                        {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
                            <Text key={index} className="text-gray-500 w-10 text-center">
                                {label}
                            </Text>
                        ))}
                    </View>
                    {isLoading ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator />
                        </View>
                    ) : (
                        <FlatList
                            data={months}
                            keyExtractor={(month) => month.toISOString()}
                            renderItem={({ item: month }) => (
                                <MonthSection
                                    month={month}
                                    bookedDates={bookedDates}
                                    selectedDate={date}
                                    setDate={handleSelectDate}
                                />
                            )}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
                            initialNumToRender={2}
                            maxToRenderPerBatch={2}
                            windowSize={5}
                            removeClippedSubviews
                        />
                    )}
                </View>
            </SafeAreaView>
        </Modal>
    );
};
