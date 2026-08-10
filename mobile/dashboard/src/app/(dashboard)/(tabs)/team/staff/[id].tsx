import { useRef } from "react";
import { View, Text, Pressable, Keyboard, Animated } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconChevronLeft } from "@tabler/icons-react-native";
import { usePitch } from "@/context/PitchContext";
import { useStaffDetails } from "@/lib/hooks/team";
import Button from "@/components/shared/Button";

export default function Details() {
    const { id } = useLocalSearchParams<{ id: string }>();

    const handleBack = () => {
        router.back();
        Keyboard.dismiss();
    };

    const { pitch, isLoading: isPitchLoading } = usePitch();
    const pitchId = pitch?.id ?? "";

    const {
        data: details,
        isLoading: isDetailsLoading,
        isRefetching: isDetailsRefetching,
        refetch: refetchDetails,
    } = useStaffDetails(pitchId, id);

    // "settings" | "schedule" | "bookings" | "analytics" | "payments" | "layout" | "team" | "properties"

    const scrollY = useRef(new Animated.Value(0)).current;

    const backButtonScale = scrollY.interpolate({
        inputRange: [0, 320 * 0.4],
        outputRange: [1, 0.75],
        extrapolate: "clamp",
    });

    const backButtonOpacity = scrollY.interpolate({
        inputRange: [0, 320 * 0.3, 320 * 0.5],
        outputRange: [1, 1, 0],
        extrapolate: "clamp",
    });

    return (
        <View className="flex-1">
            <Animated.ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                bounces
                overScrollMode="never"
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={16}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
            >
                <View style={{ height: 320 }} className="rounded-b-2xl border-b border-x border-gray-100" />
                <View className="flex-1 px-6 py-8 gap-y-8">
                    <View className="gap-y-1">
                        <Text className="text-3xl font-semibold">Ammar Yasser</Text>
                        <View className="flex-row items-center gap-x-3">
                            <Text className="text-gray-500 text-[0.925rem]">Manager</Text>
                            <View className="size-1.5 rounded-full bg-gray-300"></View>
                            <Text className="text-gray-500 text-[0.925rem]">Added at 23/2/2026</Text>
                        </View>
                    </View>
                    <View className="gap-y-3">
                        <Text className="font-medium">Overview</Text>
                        <Text className="text-gray-500 text-[0.95rem] mb-4">
                            Ammar is allowed to view and create bookings. They are allowed to view and update ground settings, schedule, and individual ground slots. They can also view payment details and view analytics. Ammar can also handle adding or removing grounds from this venue.
                        </Text>
                        <View className="flex-row items-center gap-x-6">
                            <Button className="bg-primary border-primary flex-1">
                                <Text className="font-medium text-white">History</Text>
                            </Button>
                            <Button className="border-primary flex-1">
                                <Text className="font-medium text-primary">Permissions</Text>
                            </Button>
                        </View>
                    </View>
                    <View className="gap-y-3">
                        <Text className="font-medium">History</Text>
                    </View>
                </View>
            </Animated.ScrollView>
            <SafeAreaView edges={["top"]} className="absolute top-0 left-0 px-6 py-2" pointerEvents="box-none">
                <Animated.View
                    style={{
                        opacity: backButtonOpacity,
                        transform: [{ scale: backButtonScale }],
                    }}
                >
                    <Pressable
                        className="size-11 items-center justify-center rounded-full bg-gray-100"
                        onPress={handleBack}
                    >
                        <IconChevronLeft size={18} />
                    </Pressable>
                </Animated.View>
            </SafeAreaView>
        </View>
    );
};
