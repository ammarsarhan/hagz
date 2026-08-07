import { memo, useEffect } from "react";
import { View, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { getLedgerActionMeta, LedgerEntryItem } from "@/lib/types/payments";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/string";
import cn from "@/lib/cn";
import SwipeableRow from "@/components/tabs/SwipeableRow";

export const LedgerRowSkeleton = memo(function LedgerRowSkeleton() {
    const opacity = useSharedValue(0.4);

    useEffect(() => {
        opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View
            pointerEvents="none"
            style={animatedStyle}
            className="flex-row items-center justify-between gap-x-2 border-b border-gray-100 py-4 px-6"
        >
            <View className="gap-y-1 w-1/2">
                <View className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
                <View className="h-3 bg-gray-200 rounded w-1/2" />
            </View>
            <View className="gap-y-1 flex-1 items-end justify-center">
                <View className="h-4 bg-gray-200 rounded w-24 mb-1" />
                <View className="h-3 bg-gray-200 rounded w-16" />
            </View>
        </Animated.View>
    );
});

interface LedgerRowProps {
    entry?: LedgerEntryItem;
    isOpen?: boolean;
    onOpen?: () => void;
    onClose?: () => void;
    onDelete?: () => void;
}

export default function LedgerRow({ entry, isOpen = false, onOpen, onClose, onDelete }: LedgerRowProps) {
    if (!entry) return null;

    const meta = getLedgerActionMeta(entry.type);
    const title = meta.label.en;

    const amount = entry.amount;

    let signedAmountText = "";
    let colorClass = "text-gray-500";

    if (amount > 0) {
        signedAmountText = formatCurrency(amount, { signDisplay: "always" });
        colorClass = "text-green-700";
    } else if (amount < 0) {
        signedAmountText = formatCurrency(amount);
        colorClass = "text-red-700";
    } else {
        signedAmountText = formatCurrency(0);
        colorClass = "text-gray-500";
    }

    const balanceLabel = entry.balanceAfter != null ? formatCurrency(entry.balanceAfter) : null;
    const isDeletable = entry.type === "ADJUSTMENT";

    const content = (
        <View className={cn("flex-row items-center justify-between gap-x-2 border-b border-gray-100 bg-white px-6", entry.note === null ? "py-6" : "py-4")}>
            <View className="gap-y-1 w-1/2">
                <Text className="text-gray-500 text-sm">{format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm")}</Text>
                <Text className="font-semibold">{title}</Text>
                {
                    entry.note &&
                        <Text
                            className="text-gray-500"
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {entry.note}
                        </Text>
                }
            </View>
            <View className="gap-y-1 flex-1 items-end justify-center">
                {
                    balanceLabel != null &&
                        <Text className={`font-medium text-[1.1rem]`}>{balanceLabel}</Text>
                }
                <Text className={`${colorClass} text-sm`}>{signedAmountText}</Text>
            </View>
        </View>
    );

    if (!isDeletable) {
        return content;
    }

    return (
        <SwipeableRow
            isOpen={isOpen}
            onOpen={onOpen ?? (() => {})}
            onClose={onClose ?? (() => {})}
            onDelete={onDelete ?? (() => {})}
        >
            {content}
        </SwipeableRow>
    );
}
