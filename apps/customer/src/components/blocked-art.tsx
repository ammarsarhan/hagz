import { View } from "react-native";
import { interpolate, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";
import { Layer, LIGHTS_OUT_SIZE, useLoop } from "./lights-out-art";

// The blocked screen's two scenes (app/blocked.tsx), drawn like the empty states (Lights out, No name
// on the shirt): black, white and grey on a faint black blob, 280 × 220, still with Reduce Motion on.
//   suspended: "On the bench". The ball sits out on a bench while a paused stopwatch floats above
//     it: out for now, not for good.
//   banned: "Sent off". The card floats over the pitch, the referee's whistle on the grass below.
// What stands still is one Svg; the floating object and the sparkles are rasterised layers.

const { width: W, height: H } = LIGHTS_OUT_SIZE;
const BLACK = "#000000";
const GREY = "#8E8E8E";
const WHITE = "#FFFFFF";

const BLOB =
  "M232.5 141.8 Q222.1 171.7 196.2 188.3 Q170.2 204.9 141.5 200.3 Q112.8 195.6 81.4 186.5 Q50.0 177.4 48.4 144.7 Q46.9 112.0 55.2 84.2 Q63.5 56.4 86.6 37.5 Q109.6 18.5 141.5 13.9 Q173.4 9.2 191.0 35.7 Q208.5 62.2 225.7 87.1 Q242.9 112.0 232.5 141.8Z";

// A four-pointed sparkle of radius `r` centred on (x, y).
const spark = (x: number, y: number, r: number) => {
  const c = 1.26 * (r / 7);
  return (
    `M${x} ${y - r} C${x + c} ${y - c} ${x + c} ${y - c} ${x + r} ${y} ` +
    `C${x + c} ${y + c} ${x + c} ${y + c} ${x} ${y + r} ` +
    `C${x - c} ${y + c} ${x - c} ${y + c} ${x - r} ${y} ` +
    `C${x - c} ${y - c} ${x - c} ${y - c} ${x} ${y - r}Z`
  );
};

// The ball from Lights out, centred on (x, y).
function Ball({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Circle cx={x} cy={y} r={14} fill={WHITE} stroke={BLACK} strokeWidth={3} />
      <Path
        d={`M${x} ${y - 7} L${x + 6} ${y - 3} L${x + 4} ${y + 4} L${x - 4} ${y + 4} L${x - 6} ${y - 3}Z`}
        fill={BLACK}
      />
    </>
  );
}

// The pitch along the bottom, with its halfway line.
function Pitch() {
  return (
    <>
      <Rect x={34} y={168} width={212} height={34} rx={12} fill={BLACK} />
      <Line x1={140} y1={168} x2={140} y2={202} stroke={WHITE} strokeWidth={2} />
    </>
  );
}

// The floating object's loop (±5 over 6.4 s, with a slower sideways sway) and the sparkles', which
// float against it and twinkle: the shared feel of the customer illustrations.
function useMotion() {
  const bob = useLoop(6400);
  const drift = useLoop(7600, 900);
  const sparkBob = useLoop(5200, 1600);
  const sparkDrift = useLoop(6600, 400);
  const twinkle = useLoop(3000, 700);

  const main = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(bob.value, [0, 1], [-5, 5]) },
      { translateX: interpolate(drift.value, [0, 1], [-2, 2]) },
    ],
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
  return { main, bigSpark, smallSparks };
}

export function BlockedArt({ kind }: { kind: "suspended" | "banned" }) {
  const motion = useMotion();
  return (
    <View
      style={{ width: W, height: H }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {kind === "suspended" ? <OnTheBench {...motion} /> : <SentOff {...motion} />}
    </View>
  );
}

type Motion = ReturnType<typeof useMotion>;

function OnTheBench({ main, bigSpark, smallSparks }: Motion) {
  return (
    <>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={BLOB} fill={BLACK} fillOpacity={0.07} />
        <Pitch />
        {/* The bench: backrest on two posts, the seat, two legs down to the grass. */}
        <Rect x={74} y={98} width={6} height={42} fill={BLACK} />
        <Rect x={172} y={98} width={6} height={42} fill={BLACK} />
        <Rect x={62} y={94} width={128} height={10} rx={4} fill={BLACK} />
        <Rect x={56} y={136} width={140} height={10} rx={4} fill={BLACK} />
        <Rect x={70} y={144} width={6} height={24} rx={2} fill={BLACK} />
        <Rect x={176} y={144} width={6} height={24} rx={2} fill={BLACK} />
        {/* The ball, sitting this one out. */}
        <Ball x={104} y={122} />
      </Svg>
      {/* The stopwatch, paused: crown, white face, grey quarter ticks, pause bars. */}
      <Layer style={main}>
        <Rect x={192} y={20} width={16} height={8} rx={2} fill={BLACK} />
        <Rect x={197} y={26} width={6} height={10} fill={BLACK} />
        <Circle cx={200} cy={64} r={26} fill={WHITE} stroke={BLACK} strokeWidth={4} />
        <Line
          x1={200}
          y1={42}
          x2={200}
          y2={46}
          stroke={GREY}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <Line
          x1={200}
          y1={82}
          x2={200}
          y2={86}
          stroke={GREY}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <Line
          x1={178}
          y1={64}
          x2={182}
          y2={64}
          stroke={GREY}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <Line
          x1={218}
          y1={64}
          x2={222}
          y2={64}
          stroke={GREY}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <Rect x={190} y={53} width={7} height={22} rx={2} fill={BLACK} />
        <Rect x={203} y={53} width={7} height={22} rx={2} fill={BLACK} />
      </Layer>
      <Layer style={bigSpark}>
        <Path d={spark(62, 70, 7)} fill={BLACK} />
      </Layer>
      <Layer style={smallSparks}>
        <Path d={spark(122, 44, 5)} fill={GREY} />
        <Path d={spark(234, 128, 4)} fill={BLACK} />
      </Layer>
    </>
  );
}

function SentOff({ main, bigSpark, smallSparks }: Motion) {
  return (
    <>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={BLOB} fill={BLACK} fillOpacity={0.07} />
        <Pitch />
        {/* The whistle on the grass, its grey lanyard looping up behind it. */}
        <Path
          d="M72 144 C52 124 54 98 80 94 C104 90 114 110 108 140"
          fill="none"
          stroke={GREY}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Rect x={78} y={140} width={36} height={12} rx={3} fill={BLACK} />
        <Circle cx={78} cy={154} r={14} fill={BLACK} />
        <Circle cx={78} cy={154} r={5} fill={WHITE} />
        <Ball x={214} y={154} />
      </Svg>
      {/* The card, held up at a tilt, with a glint on its corner. */}
      <Layer style={main}>
        <G transform="rotate(12 158 88)">
          <Rect x={126} y={44} width={64} height={88} rx={9} fill={BLACK} />
          <Line
            x1={137}
            y1={56}
            x2={137}
            y2={70}
            stroke={WHITE}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Line
            x1={137}
            y1={77}
            x2={137}
            y2={80}
            stroke={WHITE}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </G>
      </Layer>
      <Layer style={bigSpark}>
        <Path d={spark(226, 56, 7)} fill={BLACK} />
      </Layer>
      <Layer style={smallSparks}>
        <Path d={spark(62, 64, 5)} fill={GREY} />
        <Path d={spark(110, 30, 4)} fill={BLACK} />
      </Layer>
    </>
  );
}
