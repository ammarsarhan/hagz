import { View } from "react-native";
import { interpolate, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { Layer, LIGHTS_OUT_SIZE, useLoop } from "./lights-out-art";

// "Empty bench", Community · Mine's empty state (no games joined yet; user, 2026-11-23): a dugout
// with nobody on its bench, a water bottle waiting, and a ball bobbing on the pitch beside it. The
// "Lights out" family: black, white and grey on a faint black blob, 280 × 220, the ball and the
// sparkles moving as rasterised layers, still with Reduce Motion on.

const { width: W, height: H } = LIGHTS_OUT_SIZE;

const BLACK = "#000000";
const GREY = "#8E8E8E";
const WHITE = "#FFFFFF";

const BLOB =
  "M232.5 141.8 Q222.1 171.7 196.2 188.3 Q170.2 204.9 141.5 200.3 Q112.8 195.6 81.4 186.5 Q50.0 177.4 48.4 144.7 Q46.9 112.0 55.2 84.2 Q63.5 56.4 86.6 37.5 Q109.6 18.5 141.5 13.9 Q173.4 9.2 191.0 35.7 Q208.5 62.2 225.7 87.1 Q242.9 112.0 232.5 141.8Z";

// A four-pointed sparkle around (x, y), `r` from its centre to a point.
const spark = (x: number, y: number, r: number) => {
  const k = r * 0.18;
  return (
    `M${x} ${y - r} C${x + k} ${y - k} ${x + k} ${y - k} ${x + r} ${y} ` +
    `C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + r} ` +
    `C${x - k} ${y + k} ${x - k} ${y + k} ${x - r} ${y} ` +
    `C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - r}Z`
  );
};

export function EmptyBenchArt() {
  const bounce = useLoop(2400);
  const twinkle = useLoop(3000, 600);
  const drift = useLoop(6400, 300);

  // The ball lifts a little off the pitch and settles.
  const ball = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(bounce.value, [0, 1], [0, -9]) }],
  }));
  const bigSpark = useAnimatedStyle(() => ({
    opacity: interpolate(twinkle.value, [0, 1], [1, 0.5]),
    transform: [{ translateY: interpolate(drift.value, [0, 1], [-5, 5]) }],
  }));
  const smallSpark = useAnimatedStyle(() => ({
    opacity: interpolate(twinkle.value, [0, 1], [0.55, 1]),
    transform: [{ translateY: interpolate(drift.value, [0, 1], [4, -4]) }],
  }));

  return (
    <View
      style={{ width: W, height: H }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={BLOB} fill={BLACK} fillOpacity={0.07} />
        {/* The pitch. */}
        <Rect x={34} y={168} width={212} height={34} rx={12} fill={BLACK} />
        {/* The dugout: its curved roof on two posts. */}
        <Path d="M60 98 Q132 38 204 98 L204 110 Q132 52 60 110Z" fill={BLACK} />
        <Rect x={66} y={102} width={7} height={68} rx={3} fill={BLACK} />
        <Rect x={191} y={102} width={7} height={68} rx={3} fill={BLACK} />
        {/* The bench, nobody on it: back rest, seat, legs. */}
        <Rect x={84} y={118} width={96} height={8} rx={4} fill={GREY} />
        <Rect x={84} y={140} width={96} height={9} rx={4} fill={BLACK} />
        <Rect x={92} y={149} width={6} height={20} rx={2} fill={BLACK} />
        <Rect x={166} y={149} width={6} height={20} rx={2} fill={BLACK} />
        {/* A water bottle, waiting. */}
        <Rect
          x={150}
          y={118}
          width={13}
          height={22}
          rx={4}
          fill={WHITE}
          stroke={BLACK}
          strokeWidth={3}
        />
        <Rect x={152} y={112} width={9} height={6} rx={2} fill={BLACK} />
      </Svg>
      {/* The ball, bobbing on the pitch. */}
      <Layer style={ball}>
        <Circle cx={227} cy={153} r={13} fill={WHITE} stroke={BLACK} strokeWidth={3} />
        <Path d="M227 146.5 L232.5 150.5 L230.5 157 L223.5 157 L221.5 150.5Z" fill={BLACK} />
      </Layer>
      <Layer style={bigSpark}>
        <Path d={spark(226, 62, 8)} fill={BLACK} />
      </Layer>
      <Layer style={smallSpark}>
        <Path d={spark(48, 82, 5)} fill={GREY} />
      </Layer>
    </View>
  );
}
