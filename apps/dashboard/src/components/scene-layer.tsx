import { useEffect, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg from "react-native-svg";

// The moving-layer helpers of the customer app's scenes (its lights-out-art.tsx), for the scenes
// brought over here: what stands still is drawn once, and each moving part is its own small layer,
// rasterised, so motion is a native transform of a cached bitmap. 280 × 220, like those scenes.

const W = 280;
const H = 220;
export const SCENE_SIZE = { width: W, height: H } as const;

const EASE = Easing.inOut(Easing.sin);

// A value running 0 → 1 → 0 forever over `period`, after `delay`; parked at 0 with Reduce Motion.
export function useLoop(period: number, delay = 0) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: period / 2, easing: EASE }), -1, true),
    );
    return () => cancelAnimation(t);
  }, [period, delay, reduce, t]);
  return t;
}

// A moving part: the whole canvas in its own rasterised layer, so only its bitmap moves.
export function Layer({
  style,
  children,
}: {
  style: ReturnType<typeof useAnimatedStyle>;
  children: ReactNode;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      shouldRasterizeIOS
      renderToHardwareTextureAndroid
      style={[StyleSheet.absoluteFill, style]}
    >
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {children}
      </Svg>
    </Animated.View>
  );
}
