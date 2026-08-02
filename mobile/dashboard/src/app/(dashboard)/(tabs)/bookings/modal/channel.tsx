import Button from "@/components/shared/Button";
import { useCreateBooking } from "@/context/forms/CreateBookingContext";
import { BookingDirectPayload } from "@/lib/types/bookings";
import {
    IconChevronLeft,
    IconBrandWhatsapp,
    IconPhoneCall,
    IconWalk,
    IconDots,
} from "@tabler/icons-react-native";
import { Link, router } from "expo-router";
import { useEffect } from "react";
import { Pressable, View, Text } from "react-native";
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ChannelType = BookingDirectPayload["channel"];

const channelMap: { value: ChannelType; label: string; icon: typeof IconBrandWhatsapp; directOnly?: boolean }[] = [
    { value: "WHATSAPP", label: "WhatsApp", icon: IconBrandWhatsapp },
    { value: "WALK_IN", label: "Walk-in", icon: IconWalk, directOnly: true },
    { value: "PHONE", label: "Phone", icon: IconPhoneCall },
    { value: "OTHER", label: "Other", icon: IconDots },
];

function ChannelOption({
    selected,
    onPress,
    icon: IconNode,
    label,
}: {
    selected: boolean;
    onPress: () => void;
    icon: typeof IconBrandWhatsapp;
    label: string;
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
            className="p-4 gap-x-3 flex-row items-center rounded-lg border border-gray-100"
            style={containerStyle}
        >
            <View className="size-9 items-center justify-center rounded-full bg-gray-100">
                <IconNode size={18} color="#6B7280" />
            </View>
            <Text className="font-medium flex-1">{label}</Text>
            <Animated.View
                className="size-6 rounded-full border items-center justify-center"
                style={radioStyle}
            >
                <Animated.View className="size-3 rounded-full bg-black" style={dotStyle} />
            </Animated.View>
        </AnimatedPressable>
    );
}

export default function Channel() {
    const { state, setState } = useCreateBooking();

    const availableChannels = channelMap.filter((c) => !c.directOnly || state.isPaid);

    return (
        <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
            <View className="flex-1 p-6">
                <View className="flex-row items-center justify-between mb-3">
                    <Pressable
                        className="size-11 items-center justify-center rounded-full bg-gray-100"
                        onPress={router.back}
                    >
                        <IconChevronLeft size={18} />
                    </Pressable>
                </View>
                <View className="gap-y-2 py-2 mb-6">
                    <Text className="text-3xl font-semibold">How did this booking come in?</Text>
                    <Text className="text-gray-500">
                        Select the channel this booking was made through.
                    </Text>
                </View>
                <View className="gap-y-4 mb-10">
                    <View>
                        <Text className="font-medium">Channel</Text>
                    </View>
                    <View className="gap-y-3">
                        {
                            availableChannels.map(({ value, label, icon }) => (
                                <ChannelOption
                                    key={value}
                                    selected={state.channel === value}
                                    onPress={() => setState({ ...state, channel: value })}
                                    icon={icon}
                                    label={label}
                                />
                            ))
                        }
                    </View>
                    <Text className="text-gray-500 text-[0.925rem]">
                        {
                            state.isPaid
                                ? "Since payment is waived, you can mark this as a walk-in."
                                : "Payment hasn't been waived, so the customer needs to be reachable to confirm."
                        }
                    </Text>
                </View>
                <View className="flex-row justify-end">
                    <Link asChild href="/(dashboard)/(tabs)/bookings/modal/notes">
                        <Button className="bg-primary border-primary py-5 px-10">
                            <Text className="font-medium text-white">Next</Text>
                        </Button>
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    );
};
