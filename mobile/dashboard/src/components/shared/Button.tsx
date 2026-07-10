import React, { useCallback } from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
  type GestureResponderEvent,
} from "react-native";

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

import * as Haptics from "expo-haptics";
import cn from "@/lib/cn";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonProps = Omit<PressableProps, "className" | "children" | "onPress"> & {
  className?: string;
  textClassName?: string;
  children?: React.ReactNode;
  loading?: boolean;
  hapticStyle?: Haptics.ImpactFeedbackStyle;
  scaleTo?: number;
  onPress?: (e: GestureResponderEvent) => void;
};

export default function Button({
  className,
  textClassName,
  children,
  disabled,
  loading,
  hapticStyle = Haptics.ImpactFeedbackStyle.Light,
  scaleTo = 0.99,
  onPress,
  ...rest
}: ButtonProps) {
  const scale = useSharedValue(1);
  const isDisabled = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (isDisabled) return;
    scale.value = withSpring(scaleTo, { damping: 15, stiffness: 400, mass: 0.5 });
    Haptics.impactAsync(hapticStyle);
  }, [isDisabled, scale, scaleTo, hapticStyle]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400, mass: 0.5 });
  }, [scale]);

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (isDisabled) return;
      onPress?.(e);
    },
    [isDisabled, onPress]
  );

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={isDisabled}
      style={animatedStyle}
      className={cn(
        "flex-row items-center justify-center gap-2 px-5 py-4 rounded-full border border-transparent bg-transparent",
        isDisabled && "opacity-50",
        className
      )}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator />
      ) : typeof children === "string" ? (
        <Text className={cn("text-base font-semibold text-white", textClassName)}>
          {children}
        </Text>
      ) : (
        children
      )}
    </AnimatedPressable>
  );
};
