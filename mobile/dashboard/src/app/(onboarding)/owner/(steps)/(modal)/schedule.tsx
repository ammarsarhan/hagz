import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState } from "react";
import { IconChevronLeft, IconX } from "@tabler/icons-react-native";
import { Platform, Pressable, Switch, View, Text } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import ScheduleCircle from "@/components/shared/ScheduleCircle";
import Button from "@/components/shared/Button";
import useDraftQuery from "@/lib/hooks/useDraftQuery";
import { useGroundSchedule } from "@/lib/hooks/useGroundSchedule";
import { usePitchDraftForm } from "@/context/forms/PitchDraftContext";
import { DraftGround } from "@/lib/hooks/useGrounds";
import { DayOfWeek, DAYS_OF_WEEK, GroundScheduleDraft } from "@/lib/types/ground";

const DAY_CHARACTERS: Record<DayOfWeek, string> = {
    1: "S", 2: "M", 3: "T", 4: "W", 5: "T", 6: "F", 7: "S",
};

const DAY_LABELS: Record<DayOfWeek, string> = {
    1: "Sunday", 2: "Monday", 3: "Tuesday", 4: "Wednesday", 5: "Thursday", 6: "Friday", 7: "Saturday",
};

export default function Schedule() {
    const { groundId } = useLocalSearchParams<{ groundId: string }>();
    const { draft } = useDraftQuery();
    const { state } = usePitchDraftForm();
    const pitchId = draft!.pitchId;

    const ground = state.grounds.find((g) => (g as DraftGround).id === groundId) as DraftGround | undefined;

    const { saveAllMutation } = useGroundSchedule(pitchId, groundId);

    useEffect(() => {
        if (!ground) router.back();
    }, [ground]);

    const [scheduleDraft, setScheduleDraft] = useState<GroundScheduleDraft | null>(ground?.schedule ?? null);
    const [selectedDay, setSelectedDay] = useState<DayOfWeek>(1);

    if (!scheduleDraft) return null;

    const activeDay = scheduleDraft[selectedDay];

    const handleChange = (partial: Partial<typeof activeDay>) => {
        setScheduleDraft((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                [selectedDay]: { ...prev[selectedDay], ...partial },
            };
        });
    };

    const handleSave = () => {
        saveAllMutation.mutate(scheduleDraft, {
            onSuccess: () => router.push("/(onboarding)/owner/(steps)/(modal)/settings"),
        });
    };

    return (
        <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
            <KeyboardAwareScrollView
                className="flex-1"
                contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bottomOffset={32}
            >
                <View className="flex-row items-center justify-between mb-3">
                    <Pressable className="size-11 items-center justify-center rounded-full bg-gray-100" onPress={router.back}>
                        <IconChevronLeft size={18} />
                    </Pressable>
                </View>
                <View className="gap-y-2 py-2 mb-6">
                    <Text className="text-3xl font-semibold">Edit Schedule</Text>
                    <Text className="text-gray-500">
                        This will be used to generate the available slots for your ground once your venue is approved.
                    </Text>
                </View>
                <View className="flex-row items-center justify-between mb-6">
                    <Text className="font-medium">Ground open on {DAY_LABELS[selectedDay]}</Text>
                    <Switch
                        value={activeDay.isActive}
                        onValueChange={(value) => handleChange({ isActive: value })}
                        className="scale-90"
                        trackColor={{ false: "#D1D5DB", true: "#1C04EA" }}
                        thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
                        ios_backgroundColor="#D1D5DB"
                    />
                </View>
                <View className="flex-row gap-1.5 mb-8">
                    {DAYS_OF_WEEK.map((day) => (
                        <Pressable
                            key={day}
                            onPress={() => setSelectedDay(day)}
                            className={`flex-1 items-center py-2 rounded-md border ${
                                selectedDay === day ? "bg-primary border-primary" : "bg-gray-50 border-gray-200"
                            } ${!scheduleDraft[day].isActive ? "opacity-40" : ""}`}
                        >
                            <Text className={selectedDay === day ? "text-white font-medium" : "text-gray-500"}>
                                {DAY_CHARACTERS[day]}
                            </Text>
                        </Pressable>
                    ))}
                </View>
                <View pointerEvents={activeDay.isActive ? "auto" : "none"} style={{ opacity: activeDay.isActive ? 1 : 0.4 }}>
                    <ScheduleCircle
                        key={selectedDay}
                        initialSchedule={activeDay}
                        onChange={(schedule) => handleChange(schedule)}
                    />
                </View>
            </KeyboardAwareScrollView>
            <View className="px-6 pb-8 pt-4">
                <Button className="bg-primary border-primary" loading={saveAllMutation.isPending} onPress={handleSave}>
                    <Text className="font-medium text-white">Next</Text>
                </Button>
            </View>
        </SafeAreaView>
    );
}
