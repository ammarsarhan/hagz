import { memo, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { StaffMember } from "@/lib/types/team";

export const StaffCardSkeleton = memo(function StaffCardSkeleton() {
    const opacity = useSharedValue(0.4);

    useEffect(() => {
        opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View
            pointerEvents="none"
            style={animatedStyle}
            className="gap-y-2 items-center w-20"
        >
            <View className="rounded-full size-14 bg-gray-200" />
            <View className="items-center h-10 justify-center gap-y-1">
                <View className="h-3.5 bg-gray-200 rounded w-14" />
                <View className="h-3 bg-gray-200 rounded w-10" />
            </View>
        </Animated.View>
    );
});

interface StaffCardProps {
    member: StaffMember;
    isCurrentUser?: boolean;
    onPress?: () => void;
}

export default memo(function StaffCard({ member, isCurrentUser, onPress }: StaffCardProps) {
    const firstName = member.user?.firstName ?? "Staff";
    const initial = (firstName[0] ?? "S").toUpperCase();

    let roleText: string | null = null;
    if (isCurrentUser) {
        roleText = "(You)";
    } else if (member.role === "OWNER") {
        roleText = "(Owner)";
    }

    return (
        <Pressable onPress={onPress} className="gap-y-2 items-center w-20">
            <View className="rounded-full size-14 bg-gray-100 items-center justify-center">
                <Text className="font-medium text-lg">{initial}</Text>
            </View>
            <View className="items-center h-10 justify-center">
                <Text className="font-medium truncate" numberOfLines={1}>
                    {firstName}
                </Text>
                {roleText && (
                    <Text className="truncate text-[0.85rem]" numberOfLines={1}>
                        {roleText}
                    </Text>
                )}
            </View>
        </Pressable>
    );
});
