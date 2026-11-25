import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

// A grey stand-in, gently pulsing, in a real piece's exact size, so nothing moves when it arrives.
export function Bone({ className, style: extra }: { className: string; style?: ViewStyle }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View className={`bg-chip ${className}`} style={[style, extra]} />;
}
