import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
    useSharedValue,
    useAnimatedProps,
    withTiming,
    Easing,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
    progress: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
    trackColor?: string;
    duration?: number;
    children?: React.ReactNode;
};

export function ProgressCircle({
    progress,
    size = 33,
    strokeWidth = 3.5,
    color = "#1C04EA",
    trackColor = "#f3f4f6",
    duration = 700,
    children,
}: Props) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    const animatedProgress = useSharedValue(0);

    useEffect(() => {
        animatedProgress.value = withTiming(progress, {
            duration,
            easing: Easing.out(Easing.cubic),
        });
    }, [animatedProgress, duration, progress]);

    const animatedProps = useAnimatedProps(() => {
        const strokeDashoffset =
        circumference - (circumference * animatedProgress.value) / 100;
        return { strokeDashoffset };
    });

    return (
        <View style={{ width: size, height: size }}>
            <Svg width={size} height={size}>
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={trackColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                <AnimatedCircle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    animatedProps={animatedProps}
                    strokeLinecap="round"
                    origin={`${size / 2}, ${size / 2}`}
                    rotation={-90}
                />
            </Svg>
            {
                children && (
                    <View style={StyleSheet.absoluteFillObject}>
                        <View className="flex-1 items-center justify-center">{children}</View>
                    </View>
                )
            }
        </View>
    );
}
