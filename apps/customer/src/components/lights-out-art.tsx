import { useEffect, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

// "Lights out", Search's empty state when no venue matches (Figma "C3 · Tabs & Search", section
// "Search · No venues match", option C, 114:2; the user's pick on 2026-11-20): a floodlight with
// its lamps off under a moon, and a lone ball waiting on the pitch. Customer illustrations are
// black, white and grey only, on a faint black blob. 280 × 220.
//
// The moon and the two sparkles float (user, 2026-11-20), the way the onboarding art moves: what
// stands still is drawn once in one Svg, and each moving part is its own small layer, rasterised,
// so motion is a native transform of a cached bitmap. Slow, eased loops with no overshoot; still
// with Reduce Motion on.

const W = 280;
const H = 220;
export const LIGHTS_OUT_SIZE = { width: W, height: H } as const;

const BLACK = "#000000";
const GREY = "#8E8E8E";
const WHITE = "#FFFFFF";

const BLOB =
  "M232.5 141.8 Q222.1 171.7 196.2 188.3 Q170.2 204.9 141.5 200.3 Q112.8 195.6 81.4 186.5 Q50.0 177.4 48.4 144.7 Q46.9 112.0 55.2 84.2 Q63.5 56.4 86.6 37.5 Q109.6 18.5 141.5 13.9 Q173.4 9.2 191.0 35.7 Q208.5 62.2 225.7 87.1 Q242.9 112.0 232.5 141.8Z";
const SPARK_BIG =
  "M236 101 C237.26 106.74 237.26 106.74 243 108 C237.26 109.26 237.26 109.26 236 115 C234.74 109.26 234.74 109.26 229 108 C234.74 106.74 234.74 106.74 236 101Z";
const SPARK_SMALL =
  "M150 29 C150.9 33.1 150.9 33.1 155 34 C150.9 34.9 150.9 34.9 150 39 C149.1 34.9 149.1 34.9 145 34 C149.1 33.1 149.1 33.1 150 29Z";

const EASE = Easing.inOut(Easing.sin);

// A value running 0 → 1 → 0 forever over `period`, after `delay`; parked at 0 with Reduce Motion.
// Shared with the other empty-state scenes (no-name-art.tsx).
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

// Up and down by `rise`, swaying sideways by `sway` on its own slower loop.
const useFloat = (
  bob: SharedValue<number>,
  drift: SharedValue<number>,
  rise: number,
  sway: number,
) =>
  useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(bob.value, [0, 1], [-rise, rise]) },
      { translateX: interpolate(drift.value, [0, 1], [-sway, sway]) },
    ],
  }));

export function LightsOutArt() {
  const moonBob = useLoop(6400);
  const moonDrift = useLoop(7600, 900);
  const sparkBob = useLoop(5200, 1600);
  const sparkDrift = useLoop(6600, 400);
  const twinkle = useLoop(3000, 700);

  const moon = useFloat(moonBob, moonDrift, 5, 2.5);
  // The sparkles float against the moon (opposite phase) and twinkle.
  const bigSpark = useAnimatedStyle(() => ({
    opacity: interpolate(twinkle.value, [0, 1], [1, 0.55]),
    transform: [
      { translateY: interpolate(sparkBob.value, [0, 1], [6, -6]) },
      { translateX: interpolate(sparkDrift.value, [0, 1], [-3, 3]) },
    ],
  }));
  const smallSpark = useAnimatedStyle(() => ({
    opacity: interpolate(twinkle.value, [0, 1], [0.6, 1]),
    transform: [
      { translateY: interpolate(sparkDrift.value, [0, 1], [-5, 5]) },
      { translateX: interpolate(sparkBob.value, [0, 1], [2, -2]) },
    ],
  }));

  return (
    <View
      style={{ width: W, height: H }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={BLOB} fill={BLACK} fillOpacity={0.07} />
        {/* The pitch, with its halfway line. */}
        <Rect x={34} y={168} width={212} height={34} rx={12} fill={BLACK} />
        <Line x1={140} y1={168} x2={140} y2={202} stroke={WHITE} strokeWidth={2} />
        {/* The floodlight: pole and head, its six lamps off. */}
        <Rect x={82} y={70} width={8} height={100} rx={3} fill={BLACK} />
        <Rect x={52} y={42} width={68} height={38} rx={8} fill={BLACK} />
        {[0, 1].flatMap((row) =>
          [0, 1, 2].map((col) => (
            <Circle key={`${row}${col}`} cx={66 + col * 20} cy={54 + row * 14} r={5} fill={GREY} />
          )),
        )}
        {/* The ball, waiting. */}
        <Circle cx={176} cy={156} r={14} fill={WHITE} stroke={BLACK} strokeWidth={3} />
        <Path d="M176 149 L182 153 L180 160 L172 160 L170 153Z" fill={BLACK} />
      </Svg>
      {/* The moon: a grey disc with a white one over most of it. */}
      <Layer style={moon}>
        <Circle cx={206} cy={58} r={22} fill={GREY} />
        <Circle cx={216} cy={50} r={20} fill={WHITE} />
      </Layer>
      <Layer style={bigSpark}>
        <Path d={SPARK_BIG} fill={BLACK} />
      </Layer>
      <Layer style={smallSpark}>
        <Path d={SPARK_SMALL} fill={GREY} />
      </Layer>
    </View>
  );
}
