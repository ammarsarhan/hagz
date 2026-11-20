import { View } from "react-native";
import { interpolate, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Path, Rect, Text as SvgText } from "react-native-svg";
import { Layer, LIGHTS_OUT_SIZE, useLoop } from "./lights-out-art";

// "No name on the shirt", the Account tab's empty state for a guest (Figma C7, 170:2; the user's
// pick on 2026-11-20): a black team shirt on a hanger, its name strip blank and a question mark for
// its number. Drawn like Lights out (black, white and grey on a faint black blob, 280 × 220): the
// blob stays put, the shirt sways a little on its hook, and the sparkles float and twinkle. Still
// with Reduce Motion on.

const { width: W, height: H } = LIGHTS_OUT_SIZE;
const BLACK = "#000000";
const GREY = "#8E8E8E";
const WHITE = "#FFFFFF";

const BLOB =
  "M232.5 141.8 Q222.1 171.7 196.2 188.3 Q170.2 204.9 141.5 200.3 Q112.8 195.6 81.4 186.5 Q50.0 177.4 48.4 144.7 Q46.9 112.0 55.2 84.2 Q63.5 56.4 86.6 37.5 Q109.6 18.5 141.5 13.9 Q173.4 9.2 191.0 35.7 Q208.5 62.2 225.7 87.1 Q242.9 112.0 232.5 141.8Z";
const SHIRT =
  "M108 48 L124 40 Q140 52 156 40 L172 48 L206 70 L192 98 L178 90 L178 186 L102 186 L102 90 L88 98 L74 70Z";

// A four-pointed sparkle of radius `r` centred on (x, y).
const spark = (x: number, y: number, r: number) => {
  const k = r / 7;
  const c = 1.26 * k;
  return (
    `M${x} ${y - r} C${x + c} ${y - c} ${x + c} ${y - c} ${x + r} ${y} ` +
    `C${x + c} ${y + c} ${x + c} ${y + c} ${x} ${y + r} ` +
    `C${x - c} ${y + c} ${x - c} ${y + c} ${x - r} ${y} ` +
    `C${x - c} ${y - c} ${x - c} ${y - c} ${x} ${y - r}Z`
  );
};

export function NoNameArt() {
  const sway = useLoop(5600);
  const sparkBob = useLoop(5200, 1600);
  const sparkDrift = useLoop(6600, 400);
  const twinkle = useLoop(3000, 700);

  // Swung from the hook's top, a couple of degrees either way.
  const shirt = useAnimatedStyle(() => ({
    transformOrigin: "51% 10%",
    transform: [{ rotate: `${interpolate(sway.value, [0, 1], [-2.2, 2.2])}deg` }],
  }));
  const bigSpark = useAnimatedStyle(() => ({
    opacity: interpolate(twinkle.value, [0, 1], [1, 0.55]),
    transform: [
      { translateY: interpolate(sparkBob.value, [0, 1], [5, -5]) },
      { translateX: interpolate(sparkDrift.value, [0, 1], [-2, 2]) },
    ],
  }));
  const smallSparks = useAnimatedStyle(() => ({
    opacity: interpolate(twinkle.value, [0, 1], [0.6, 1]),
    transform: [
      { translateY: interpolate(sparkDrift.value, [0, 1], [-4, 4]) },
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
      </Svg>
      <Layer style={shirt}>
        {/* The hook and the hanger. */}
        <Path
          d="M140 22 a8 8 0 1 1 8 8 v6"
          fill="none"
          stroke={GREY}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Path
          d="M92 50 L148 36 L204 50"
          fill="none"
          stroke={GREY}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* The shirt, its name strip blank and a question mark for its number. */}
        <Path d={SHIRT} fill={BLACK} stroke={BLACK} strokeWidth={2} strokeLinejoin="round" />
        <Rect x={114} y={74} width={52} height={10} rx={5} fill={WHITE} fillOpacity={0.9} />
        <SvgText x={140} y={150} textAnchor="middle" fontSize={58} fontWeight="700" fill={WHITE}>
          ?
        </SvgText>
      </Layer>
      <Layer style={bigSpark}>
        <Path d={spark(60, 120, 7)} fill={BLACK} />
      </Layer>
      <Layer style={smallSparks}>
        <Path d={spark(222, 50, 5)} fill={GREY} />
        <Path d={spark(230, 150, 4)} fill={BLACK} />
      </Layer>
    </View>
  );
}
