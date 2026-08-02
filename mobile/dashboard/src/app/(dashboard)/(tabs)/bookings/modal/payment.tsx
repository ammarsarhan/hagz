import Button from "@/components/shared/Button";
import { useCreateBooking } from "@/context/forms/CreateBookingContext";
import { useRequiredPitch } from "@/context/PitchContext";
import { useGroundConfig } from "@/lib/hooks/useGroundConfig";
import { BookingDirectPayload } from "@/lib/types/bookings";
import {
    IconCash,
    IconCreditCard,
    IconWallet,
    IconChevronLeft,
} from "@tabler/icons-react-native";
import { Link, router } from "expo-router";
import { useEffect } from "react";
import { Pressable, View, Text, Switch, Platform } from "react-native";
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PaymentMethod = BookingDirectPayload["paymentMethod"];

const methodMap: { value: PaymentMethod; label: string; icon: typeof IconCash }[] = [
    { value: "CASH", label: "Cash", icon: IconCash },
    { value: "CARD", label: "Card", icon: IconCreditCard },
    { value: "WALLET", label: "Wallet", icon: IconWallet },
];

function PaymentOption({
    selected,
    onPress,
    icon: IconNode,
    label,
}: {
    selected: boolean;
    onPress: () => void;
    icon: typeof IconCash;
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

export default function Payment() {
    const { state, setState } = useCreateBooking();
    const { pitch } = useRequiredPitch();

    const configQuery = useGroundConfig(pitch.id, state.groundId!);
    const paymentExpiry = configQuery.data?.config.settings.paymentExpiryLimit;

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
                    <Text className="text-3xl font-semibold">How is {state.customer.firstName} paying?</Text>
                    <Text className="text-gray-500">
                        Indicate whether this booking has already been paid and select the payment method.
                    </Text>
                </View>
                <View className="gap-y-5 mb-10">
                    <View className="flex-row items-center justify-between">
                        <Text className="font-medium">Waive Payment?</Text>
                        <Switch
                            value={state.isPaid}
                            onValueChange={(isPaid) => setState({ ...state, isPaid })}
                            className="scale-90"
                            trackColor={{ false: "#D1D5DB", true: "#1C04EA" }}
                            thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
                            ios_backgroundColor="#D1D5DB"
                        />
                    </View>
                    <Text className="text-gray-500 text-[0.925rem]">
                        This booking will be reserved for {paymentExpiry} minutes while the customer completes payment. Otherwise, it will automatically expire.
                    </Text>
                </View>
                <View className="gap-y-4 mb-10">
                    <View>
                        <Text className="font-medium">Payment Method</Text>
                    </View>
                    <View className="gap-y-3">
                        {
                            methodMap.map(({ value, label, icon }) => (
                                <PaymentOption
                                    key={value}
                                    selected={state.paymentMethod === value}
                                    onPress={() => setState({ ...state, paymentMethod: value })}
                                    icon={icon}
                                    label={label}
                                />
                            ))
                        }
                    </View>
                    <Text className="text-gray-500 text-[0.925rem]">If payment is not waived, the customer will receive a Whatsapp message with instructions on how to confirm their booking.</Text>
                </View>
                <View className="flex-row justify-end">
                    <Link asChild href="/(dashboard)/(tabs)/bookings/modal/channel">
                        <Button className="bg-primary border-primary py-5 px-10">
                            <Text className="font-medium text-white">Next</Text>
                        </Button>
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    );
};