import { memo, useCallback, useEffect, useMemo } from "react";
import { View, Text } from "react-native";
import Animated, {
    Easing,
    interpolateColor,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { router } from "expo-router";
import { StaffMember } from "@/lib/types/team";
import cn from "@/lib/cn";

export const StaffCardSkeleton = memo(function StaffCardSkeleton() {
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
            className="gap-y-2 items-center w-24 py-3 rounded-lg"
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
    isCurrent?: boolean;
}

export default memo(function StaffCard({ member, isCurrent }: StaffCardProps) {
    const firstName = member.user?.firstName ?? "Staff";
    const initial = (firstName[0] ?? "S").toUpperCase();
    const pressed = useSharedValue(0);

    const isPrimary = useMemo(() => Math.random() < 0.5, []);

    let roleText: string | null = null;
    if (isCurrent) {
        roleText = "(You)";
    } else if (member.role === "OWNER") {
        roleText = "(Owner)";
    }

    const navigateToStaff = useCallback((userId: string) => {
        if (isCurrent) return;
        router.push(`/(dashboard)/(tabs)/team/staff/${userId}`);
    }, []);

    const tapGesture = Gesture.Tap()
        .onTouchesDown(() => {
            pressed.value = withTiming(1, {
                duration: 120,
                easing: Easing.inOut(Easing.ease),
            });
        })
        .onTouchesUp(() => {
            pressed.value = withTiming(0, {
                duration: 200,
                easing: Easing.inOut(Easing.ease),
            });
        })
        .onTouchesCancelled(() => {
            pressed.value = withTiming(0, {
                duration: 200,
                easing: Easing.inOut(Easing.ease),
            });
        })
        .onEnd((_, success) => {
            if (success) {
                runOnJS(navigateToStaff)(member.userId);
            }
        });

    const longPressGesture = Gesture.LongPress().minDuration(150);

    const gesture = Gesture.Race(tapGesture, longPressGesture);

    const animatedContainerStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            pressed.value,
            [0, 1],
            ["transparent", "#F3F4F6"]
        ),
    }));

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View
                style={!isCurrent ? animatedContainerStyle : null}
                className="gap-y-2 items-center w-24 rounded-lg py-3"
            >
                <View
                    className={cn(
                        "rounded-full size-14 items-center justify-center",
                        isPrimary ? "bg-primary/10" : "bg-secondary/30"
                    )}
                >
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
            </Animated.View>
        </GestureDetector>
    );
});
