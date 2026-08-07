import { memo, useEffect } from "react";
import { View, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { PayoutItem } from "@/lib/types/payments";
import { format } from "date-fns";
import { formatCurrency, parseEnum } from "@/lib/string";

export const PayoutRowSkeleton = memo(function PayoutRowSkeleton() {
    const opacity = useSharedValue(0.4);

    useEffect(() => {
        opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View
            pointerEvents="none"
            style={animatedStyle}
            className="flex-row items-center justify-between gap-x-2 border-b border-gray-100 py-4"
        >
            <View className="gap-y-1 w-1/2">
                <View className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
                <View className="h-3 bg-gray-200 rounded w-1/2" />
            </View>
            <View className="flex-1 items-end justify-center">
                <View className="h-5 bg-gray-200 rounded w-24" />
            </View>
        </Animated.View>
    );
});

interface PayoutRowProps {
    payout: PayoutItem;
}

export default function PayoutRow({ payout }: PayoutRowProps) {
    const title = parseEnum(payout.method);

    const subtitle = payout.destination
        ? `${payout.destination}`
        : format(new Date(payout.requestedAt), "dd/MM/yyyy • HH:mm");

    const isFailed = payout.status === "FAILED";

    const amountText = isFailed
        ? formatCurrency(payout.amount)
        : formatCurrency(-payout.amount);

    const colorClass = isFailed ? "text-gray-500" : "text-red-700";

    return (
        <View className="flex-row items-center justify-between gap-x-2 border-b border-gray-100 py-4">
            <View className="gap-y-1 w-1/2">
                <Text className="font-semibold">{title}</Text>
                <Text
                    className="text-gray-500"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                >
                    {subtitle}
                </Text>
                <View className="flex-row mt-2">
                    <View className="px-5 py-2 rounded-full border border-gray-200">
                        <Text className="text-sm text-gray-800 font-medium">
                            {parseEnum(payout.status)}
                        </Text>
                    </View>
                </View>
            </View>
            <View className="flex-1 items-end justify-center">
                <Text className={`font-medium text-[1.1rem] ${colorClass}`}>
                    {amountText}
                </Text>
            </View>
        </View>
    );
}
