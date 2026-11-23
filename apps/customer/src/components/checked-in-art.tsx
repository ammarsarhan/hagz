import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { Layer, LIGHTS_OUT_SIZE, useLoop } from "./lights-out-art";

// "Torn", You're checked in (Figma C8 "Check-in · Done", 276:2): the ticket torn along its
// perforation, its stub carrying a tick. Black, white and grey on the faint black blob, like every
// customer illustration. 280 × 220, Lights out's canvas, so it shares its moving-layer helpers.
//
// It opens on the check-in itself, once (the house intro: 650 ms ease-out, no springs): the stub
// sits on the ticket, then tears off along the perforation to where it rests, its tick draws, and
// the sparkles come in. Then the loops: the stub floats away from the ticket and back, and the
// sparkles twinkle, each its own rasterised layer. With Reduce Motion on it starts torn, and stays
// still.

const { width: W, height: H } = LIGHTS_OUT_SIZE;
const BLACK = "#000000";
const GREY = "#8E8E8E";
const WHITE = "#FFFFFF";

const BLOB =
  "M232.5 141.8C225.567 161.733 213.467 177.233 196.2 188.3C178.867 199.367 160.633 203.367 141.5 200.3C122.367 197.167 102.333 192.567 81.4 186.5C60.4667 180.433 49.4667 166.5 48.4 144.7C47.4 122.9 49.6667 102.733 55.2 84.2C60.7333 65.6667 71.2 50.1 86.6 37.5C101.933 24.8333 120.233 16.9667 141.5 13.9C162.767 10.7667 179.267 18.0333 191 35.7C202.667 53.3667 214.233 70.5 225.7 87.1C237.167 103.7 239.433 121.933 232.5 141.8Z";
const TICKET =
  "M48 60H160L166 68L160 76L166 84L160 92L166 100L160 108L166 116L160 124L166 132L160 140L166 148L160 156H48C42.6667 156 40 153.333 40 148V68C40 62.6667 42.6667 60 48 60Z";
const STUB =
  "M184 74L190 82L184 90L190 98L184 106L190 114L184 122L190 130L184 138L190 146L184 154L190 162L184 170H232C237.333 170 240 167.333 240 162V82C240 76.6667 237.333 74 232 74H184Z";
// Where the stub sits on the ticket before it tears: its perforation (x 184) on the ticket's (160),
// level with it.
const ON_TICKET = { x: -24, y: -14 };
// The tick's length, for drawing it in.
const TICK = 26;
// The intro: a beat, the tear, then the tick.
const BEAT = 250;
const TEAR = 650;
const DRAW = 350;

// When the stub tears off (ms from mount), for the screen to time its haptic and text by.
export const TORN_AT = BEAT + TEAR * 0.4;

const AnimatedPath = Animated.createAnimatedComponent(Path);

const SPARKS = [
  {
    d: "M70 33C71.62 40.38 71.62 40.38 79 42C71.62 43.62 71.62 43.62 70 51C68.38 43.62 68.38 43.62 61 42C68.38 40.38 68.38 40.38 70 33Z",
  },
  {
    d: "M150 179C151.26 184.74 151.26 184.74 157 186C151.26 187.26 151.26 187.26 150 193C148.74 187.26 148.74 187.26 143 186C148.74 184.74 148.74 184.74 150 179Z",
  },
  {
    d: "M248 48C249.08 52.92 249.08 52.92 254 54C249.08 55.08 249.08 55.08 248 60C246.92 55.08 246.92 55.08 242 54C246.92 52.92 246.92 52.92 248 48Z",
  },
];

// `intro`: the check-in just happened, so it tears; opened again later, it's already torn.
export function CheckedInArt({ intro = true }: { intro?: boolean }) {
  const drift = useLoop(6400);
  const bob = useLoop(7200, 800);
  const twinkle = useLoop(3200, 500);
  const reduce = useReducedMotion();
  const still = reduce || !intro;
  // 0 on the ticket, 1 torn off; then the tick, 0 to drawn.
  const torn = useSharedValue(still ? 1 : 0);
  const ticked = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    torn.value = withDelay(
      BEAT,
      withTiming(1, { duration: TEAR, easing: Easing.out(Easing.cubic) }),
    );
    ticked.value = withDelay(
      BEAT + TEAR * 0.6,
      withTiming(1, { duration: DRAW, easing: Easing.out(Easing.cubic) }),
    );
  }, [still, torn, ticked]);

  // Off the ticket to where it rests, then drifting off the tear and back, rising and falling a
  // little out of step; the loops come in as the tear finishes.
  const stub = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          interpolate(torn.value, [0, 1], [ON_TICKET.x, 0]) +
          torn.value * interpolate(drift.value, [0, 1], [-2, 5]),
      },
      {
        translateY:
          interpolate(torn.value, [0, 1], [ON_TICKET.y, 0]) +
          torn.value * interpolate(bob.value, [0, 1], [-4, 4]),
      },
      { rotate: `${torn.value * interpolate(drift.value, [0, 1], [0, 3])}deg` },
    ],
  }));
  const tick = useAnimatedProps(() => ({ strokeDashoffset: TICK * (1 - ticked.value) }));
  const sparks = useAnimatedStyle(() => ({
    opacity:
      interpolate(ticked.value, [0, 1], [0, 1]) * interpolate(twinkle.value, [0, 1], [1, 0.5]),
    transform: [{ translateY: interpolate(bob.value, [0, 1], [5, -5]) }],
  }));

  return (
    <View
      style={{ width: W, height: H }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={BLOB} fill={BLACK} fillOpacity={0.07} />
        {/* The ticket: two white lines of print and a grey one. */}
        <Path d={TICKET} fill={BLACK} />
        <Path d="M62.5 78H113.5A4.5 4.5 0 0 1 113.5 87H62.5A4.5 4.5 0 0 1 62.5 78Z" fill={WHITE} />
        <Path d="M62.5 95H93.5A4.5 4.5 0 0 1 93.5 104H62.5A4.5 4.5 0 0 1 62.5 95Z" fill={WHITE} />
        <Path
          d="M61.5 134H124.5A3.5 3.5 0 0 1 124.5 141H61.5A3.5 3.5 0 0 1 61.5 134Z"
          fill={GREY}
        />
      </Svg>
      {/* The stub, torn off, with its tick. */}
      <Layer style={stub}>
        <Path d={STUB} fill={BLACK} />
        <Path d="M214 105A17 17 0 1 1 214 139A17 17 0 1 1 214 105Z" fill={WHITE} />
        <AnimatedPath
          d="M206 122L212 128L222 116"
          stroke={BLACK}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={TICK}
          animatedProps={tick}
          fill="none"
        />
      </Layer>
      <Layer style={sparks}>
        {SPARKS.map((spark) => (
          <Path key={spark.d} d={spark.d} fill={GREY} />
        ))}
      </Layer>
    </View>
  );
}
