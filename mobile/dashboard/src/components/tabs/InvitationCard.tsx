import { memo, useEffect, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { IconChevronRight } from "@tabler/icons-react-native";
import { Invitation } from "@/lib/types/team";
import { formatPhone } from "@/lib/string";
import cn from "@/lib/cn";

export const InvitationCardSkeleton = memo(function InvitationCardSkeleton() {
    const opacity = useSharedValue(0.4);

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View
            pointerEvents="none"
            style={animatedStyle}
            className="border-b border-gray-100 py-6 px-2 flex-row items-center"
        >
            <View className="flex-row items-center gap-x-5 flex-1">
                <View className="rounded-full size-11 bg-gray-200" />
                <View className="gap-y-1.5 flex-1">
                    <View className="h-3.5 bg-gray-200 rounded w-28" />
                    <View className="h-4 bg-gray-200 rounded w-40" />
                    <View className="h-3 bg-gray-200 rounded w-16" />
                </View>
            </View>
        </Animated.View>
    );
});

interface InvitationCardProps {
    invitation: Invitation;
    onPress?: () => void;
}

export default memo(function InvitationCard({ invitation, onPress }: InvitationCardProps) {
    const initial = (invitation.name?.[0] ?? "A").toUpperCase();
    const statusText = invitation.status
        ? invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1).toLowerCase()
        : "Pending";

    const isPrimary = useMemo(() => Math.random() < 0.5, []);

    return (
        <Pressable onPress={onPress} className="border-b border-gray-100 py-6 px-2 flex-row items-center">
            <View className="flex-row items-center gap-x-5 flex-1">
                <View className={cn("items-center justify-center rounded-full size-11", isPrimary ? "bg-primary/10" : "bg-secondary/30")}>
                    <Text className="text-black">{initial}</Text>
                </View>
                <View className="gap-y-0.5">
                    <Text className="text-gray-500">{formatPhone(invitation.phone)}</Text>
                    <Text className="font-medium text-[1.1rem]">{invitation.name}</Text>
                    <Text className="text-gray-500">{statusText}</Text>
                </View>
            </View>
            <IconChevronRight strokeWidth={1.75} width={20} height={20} color="#6B7280" />
        </Pressable>
    );
});
