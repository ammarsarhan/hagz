import Button from "@/components/shared/Button";
import { useCreateBooking } from "@/context/forms/CreateBookingContext";
import { usePitch, useRequiredPitch } from "@/context/PitchContext";
import { sizeMap, sportMap } from "@/lib/types/ground";
import { IconX } from "@tabler/icons-react-native";
import { Link, router } from "expo-router";
import { useEffect } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function GroundOption({
    selected,
    onPress,
    sizeIcon: SizeIconNode,
    sportIcon: SportIconNode,
    title,
    sizeLabel,
    sportLabel,
}: {
    selected: boolean;
    onPress: () => void;
    sizeIcon: React.ReactNode;
    sportIcon: React.ReactNode;
    title: string;
    sizeLabel: string;
    sportLabel: string;
}) {
    const progress = useSharedValue(selected ? 1 : 0);
    const pressed = useSharedValue(1);

    useEffect(() => {
        progress.value = withTiming(selected ? 1 : 0, { duration: 200 });
    }, [progress, selected]);

    const containerStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(progress.value, [0, 1], ["#FFFFFF", "#F3F4F6"]),
        transform: [{ scale: pressed.value }],
    }));

    const radioStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(progress.value, [0, 1], ["#E5E7EB", "#000000"]),
    }));

    const dotStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [{ scale: progress.value }],
    }));

    return (
        <AnimatedPressable
            onPress={onPress}
            onPressIn={() => (pressed.value = withSpring(0.98))}
            onPressOut={() => (pressed.value = withSpring(1))}
            className="p-5 gap-x-6 flex-row items-center rounded-lg border border-gray-100"
            style={containerStyle}
        >
            <View className="flex-1">
                <Text className="text-lg font-medium">{title}</Text>
                <View className="gap-y-2 mt-2.5">
                    <View className="flex-row items-center gap-x-1.5">
                        {SportIconNode}
                        <Text className="text-gray-500 text-sm">{sportLabel}</Text>
                    </View>
                    <View className="flex-row items-center gap-x-1.5">
                        {SizeIconNode}
                        <Text className="text-gray-500 text-sm">{sizeLabel}</Text>
                    </View>
                </View>
            </View>
            <Animated.View
                className="size-7 bg-white rounded-full border items-center justify-center"
                style={radioStyle}
            >
                <Animated.View className="size-3.5 rounded-full bg-black" style={dotStyle} />
            </Animated.View>
        </AnimatedPressable>
    );
};

export default function Index() {
    const { pitch } = useRequiredPitch();
    const { state, setState } = useCreateBooking();

    return (
        <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
            <ScrollView className="flex-1" contentContainerClassName="p-6 pb-28">
                <View className="flex-row items-center justify-between mb-3">
                    <Pressable
                        className="size-11 items-center justify-center rounded-full bg-gray-100"
                        onPress={router.back}
                    >
                        <IconX size={18} />
                    </Pressable>
                </View>
                <View className="gap-y-2 py-2 mb-6">
                    <Text className="text-3xl font-semibold">Select a ground</Text>
                    <Text className="text-gray-500">
                        Choose the ground where you&apos;d like to create the booking.
                    </Text>
                </View>
                <View className="gap-y-3">
                    {
                        pitch.grounds.map((ground) => {
                            const sizeConfig = sizeMap[ground.size];
                            const sportConfig = sportMap[ground.sport];

                            const SizeIcon = sizeConfig.icon;
                            const SportIcon = sportConfig.icon;

                            const isSelected = state.groundId === ground.id; 

                            return (
                                <GroundOption
                                    key={ground.id}
                                    selected={isSelected}
                                    onPress={() => {
                                        setState({ ...state, groundId: ground.id })
                                    }}
                                    title={ground.name ?? "Ground"}
                                    sizeLabel={sizeConfig.label.en}
                                    sportLabel={sportConfig.label.en}
                                    sizeIcon={<SizeIcon size={18} color="#6B7280" />}
                                    sportIcon={<SportIcon size={18} color="#6B7280" />}
                                />
                            );
                        })
                    }
                </View>
            </ScrollView>
            <View className="absolute bottom-10 right-6 z-10">
                <Link asChild href="/(dashboard)/(tabs)/bookings/modal/customer">
                    <Button className="border-primary bg-primary px-8" disabled={state.groundId === null}>
                        <Text className="text-white font-medium">Continue</Text>
                    </Button>
                </Link>
            </View>
        </SafeAreaView>
    );
};