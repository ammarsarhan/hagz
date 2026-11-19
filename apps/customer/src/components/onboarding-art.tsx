import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// The three onboarding illustrations from the approved Figma slides (customer file
// YdkY80zjQpKEBCIcxDsxCq, page "C1 · Auth", section "Onboarding · slideshow"), drawn on a 345 × 330
// canvas and animated. Every moving part is its own layer: a full-canvas Svg inside an Animated.View,
// so motion runs as native view transforms on the UI thread (react-native-svg's own transform props
// are turned into a matrix in JavaScript, which animated props would skip).
//
// Each layer can drift with the swipe (parallax by depth), loop softly, and drop in the first time
// its slide lands. With Reduce Motion on, the drawings stand still.
//
// Customer illustrations are black, white and grey only, never in a brand colour.
const W = 345;
const H = 330;

const BLACK = "#000000";
const GREY = "#8E8E8E";
const WHITE = "#FFFFFF";
// A faint grey wash over the lime background, so the blob reads without a colour of its own.
const BLOB = BLACK;
const BLOB_OPACITY = 0.07;

// A smooth organic outline: points at varying radii around a centre, joined with Catmull-Rom curves.
function blob(cx: number, cy: number, radii: number[], turn: number) {
  const points = radii.map((r, i) => {
    const a = turn + (i * 2 * Math.PI) / radii.length;
    return [cx + r * Math.cos(a), cy + r * 0.92 * Math.sin(a)] as const;
  });
  const at = (i: number) => points[(i + points.length) % points.length]!;
  const n = (v: number) => v.toFixed(1);
  let d = `M${n(at(0)[0])} ${n(at(0)[1])}`;
  for (let i = 0; i < points.length; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += ` C${n(p1[0] + (p2[0] - p0[0]) / 6)} ${n(p1[1] + (p2[1] - p0[1]) / 6)} ${n(p2[0] - (p3[0] - p1[0]) / 6)} ${n(p2[1] - (p3[1] - p1[1]) / 6)} ${n(p2[0])} ${n(p2[1])}`;
  }
  return `${d}Z`;
}

// A four-point sparkle.
function spark(cx: number, cy: number, s: number) {
  return `M${cx} ${cy - s} Q${cx} ${cy} ${cx + s} ${cy} Q${cx} ${cy} ${cx} ${cy + s} Q${cx} ${cy} ${cx - s} ${cy} Q${cx} ${cy} ${cx} ${cy - s}Z`;
}

function star(cx: number, cy: number, outer: number, inner: number) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? inner : outer;
    d += `${i ? "L" : "M"}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return `${d}Z`;
}

// A player: a round head over rounded shoulders; open = the dashed spot nobody has taken.
function Player({
  cx,
  cy,
  fill,
  open = false,
}: {
  cx: number;
  cy: number;
  fill?: string;
  open?: boolean;
}) {
  const top = cy + 46;
  const bottom = cy + 62;
  const body = `M${cx - 28} ${bottom - 4} L${cx - 28} ${top} A28 22 0 0 1 ${cx + 28} ${top} L${cx + 28} ${bottom - 4} Q${cx + 28} ${bottom} ${cx + 24} ${bottom} L${cx - 24} ${bottom} Q${cx - 28} ${bottom} ${cx - 28} ${bottom - 4}Z`;
  const paint = open
    ? { fill: "none", stroke: BLACK, strokeWidth: 2, strokeDasharray: "5 5" }
    : { fill };
  return (
    <>
      <Circle cx={cx} cy={cy} r={18} {...paint} />
      <Path d={body} {...paint} />
    </>
  );
}

// A soft back-and-forth: 0 → 1 → 0, forever. Each part gets its own period and delay so nothing
// moves in step.
type Range = readonly [number, number];
interface Loop {
  period: number;
  delay?: number;
  x?: Range;
  y?: Range;
  rotate?: Range;
  scale?: Range;
  opacity?: Range;
}

interface PartProps {
  k: number;
  offset: SharedValue<number>;
  // How far the part drifts against the swipe, in points per page: 0 moves with the slide, more
  // lags behind it.
  depth?: number;
  loop?: Loop;
  // Drops in from this many canvas units above when the slide lands.
  drop?: { from: number; entry: SharedValue<number> };
  // The point it rotates and scales around, in canvas units.
  origin?: readonly [number, number];
  children: ReactNode;
}

function Part({ k, offset, depth = 16, loop, drop, origin = [W / 2, H / 2], children }: PartProps) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (!loop || reduce) return;
    t.value = withDelay(
      loop.delay ?? 0,
      withRepeat(
        withTiming(1, { duration: loop.period / 2, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(t);
    // The loop is fixed for the part's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  const style = useAnimatedStyle(() => {
    const p = t.value;
    const at = (range: Range | undefined, rest: number) =>
      range ? range[0] + (range[1] - range[0]) * p : rest;
    const entry = drop ? drop.entry.value : 1;
    return {
      opacity: at(loop?.opacity, 1) * (drop ? Math.min(1, entry * 2) : 1),
      transform: [
        { translateX: offset.value * depth + at(loop?.x, 0) * k },
        { translateY: (at(loop?.y, 0) - (drop ? drop.from * (1 - entry) : 0)) * k },
        { rotate: `${at(loop?.rotate, 0)}deg` },
        { scale: at(loop?.scale, 1) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { transformOrigin: [origin[0] * k, origin[1] * k, 0] },
        style,
      ]}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        {children}
      </Svg>
    </Animated.View>
  );
}

function Spark({
  k,
  offset,
  at,
  size,
  delay,
  color = BLACK,
}: {
  k: number;
  offset: SharedValue<number>;
  at: readonly [number, number];
  size: number;
  delay: number;
  color?: string;
}) {
  return (
    <Part
      k={k}
      offset={offset}
      depth={28}
      origin={at}
      loop={{ period: 2400, delay, scale: [0.55, 1], opacity: [0.5, 1] }}
    >
      <Path d={spark(at[0], at[1], size)} fill={color} />
    </Part>
  );
}

function Blob({ k, offset, d }: { k: number; offset: SharedValue<number>; d: string }) {
  return (
    <Part
      k={k}
      offset={offset}
      depth={6}
      origin={[172, 185]}
      loop={{ period: 7000, scale: [1, 1.035] }}
    >
      <Path d={d} fill={BLOB} fillOpacity={BLOB_OPACITY} />
    </Part>
  );
}

// Plays a spring from 0 to 1 the first time the slide lands, and never again: coming back to the
// slide finds the part already in place.
function useEntry(active: boolean) {
  const reduce = useReducedMotion();
  const entry = useSharedValue(reduce ? 1 : 0);
  const played = useRef(false);
  useEffect(() => {
    if (reduce) entry.value = 1;
    else if (active && !played.current) {
      played.current = true;
      entry.value = withDelay(120, withSpring(1, { damping: 11, stiffness: 140 }));
    }
  }, [active, reduce, entry]);
  return entry;
}

interface SceneProps {
  k: number;
  offset: SharedValue<number>;
  active: boolean;
}

const BLOB_1 = blob(172, 190, [138, 128, 145, 132, 140, 126, 146, 134, 130, 142], 0.3);
const BLOB_2 = blob(172, 180, [134, 144, 128, 140, 132, 146, 130, 138, 142, 128], 1.1);
const BLOB_3 = blob(172, 180, [140, 130, 146, 128, 142, 134, 138, 126, 144, 132], 0.6);

// 1 · Pitch hunting, handled: a pin drops onto a pitch while free slots float around it.
function PitchScene({ k, offset, active }: SceneProps) {
  const entry = useEntry(active);
  return (
    <>
      <Blob k={k} offset={offset} d={BLOB_1} />
      <Part k={k} offset={offset} depth={10}>
        <Rect x={62} y={150} width={220} height={140} rx={22} fill={BLACK} />
        <Path
          d="M84 164 H260 Q268 164 268 172 V268 Q268 276 260 276 H84 Q76 276 76 268 V172 Q76 164 84 164Z M172 164 V276 M76 198 H98 V242 H76 M268 198 H246 V242 H268"
          stroke={WHITE}
          strokeOpacity={0.4}
          strokeWidth={3}
          strokeLinejoin="round"
          fill="none"
        />
        <Circle
          cx={172}
          cy={220}
          r={22}
          stroke={WHITE}
          strokeOpacity={0.4}
          strokeWidth={3}
          fill="none"
        />
      </Part>
      <Part k={k} offset={offset} depth={30} loop={{ period: 3600, y: [-4, 4] }}>
        <Rect x={30} y={96} width={66} height={30} rx={15} fill={WHITE} />
      </Part>
      <Part k={k} offset={offset} depth={36} loop={{ period: 4200, delay: 500, y: [4, -4] }}>
        <Path
          d="M330 22 C340 44 330 64 312 74"
          stroke={BLACK}
          strokeOpacity={0.35}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        />
        <Rect x={250} y={78} width={66} height={30} rx={15} fill={GREY} />
      </Part>
      <Part k={k} offset={offset} depth={24} loop={{ period: 3900, delay: 900, y: [-3, 3] }}>
        <Rect x={24} y={292} width={66} height={30} rx={15} fill={BLACK} />
      </Part>
      <Part
        k={k}
        offset={offset}
        depth={24}
        loop={{ period: 3300, delay: 300, y: [3, -3], opacity: [1, 0.55] }}
      >
        <Rect
          x={256}
          y={294}
          width={66}
          height={30}
          rx={15}
          fill="none"
          stroke={BLACK}
          strokeWidth={2}
          strokeDasharray="5 5"
        />
      </Part>
      <Part
        k={k}
        offset={offset}
        depth={20}
        drop={{ from: 70, entry }}
        loop={{ period: 2600, delay: 900, y: [0, -6] }}
      >
        <Path
          d="M172 214 C160 194 138 168 138 136 A34 34 0 1 1 206 136 C206 168 184 194 172 214Z"
          fill={WHITE}
        />
        <Circle cx={172} cy={135} r={13} fill={BLACK} />
      </Part>
      <Spark k={k} offset={offset} at={[40, 196]} size={9} delay={0} />
      <Spark k={k} offset={offset} at={[314, 176]} size={11} delay={700} color={GREY} />
      <Spark k={k} offset={offset} at={[124, 62]} size={6} delay={1300} />
      <Spark k={k} offset={offset} at={[306, 246]} size={6} delay={400} />
    </>
  );
}

// A venue's punch card, with the same 22 of padding above the title and below the stamps: stamps
// for the bookings played, the last one landing, and the free booking waiting in the final spot.
const CARD_LOOP: Loop = { period: 3800, y: [0, -4] };
const STAMPED = [
  [92, 200],
  [165, 200],
  [238, 200],
  [92, 248],
] as const;
const LAST_STAMP = [165, 248] as const;
const FREE_SPOT = [238, 248] as const;
const BLOB_4 = blob(172, 185, [136, 146, 130, 142, 128, 144, 134, 140, 126, 138], 0.9);

function Stamp({ at }: { at: readonly [number, number] }) {
  return (
    <>
      <Circle cx={at[0]} cy={at[1]} r={20} fill={WHITE} />
      <Path d={star(at[0], at[1], 8, 6.5)} fill={BLACK} />
    </>
  );
}

// 2 · Frequent fixtures, free: the last stamp drops onto the card the first time the slide lands,
// and the free booking's spot pulses softly.
function LoyaltyScene({ k, offset, active }: SceneProps) {
  const entry = useEntry(active);
  return (
    <>
      <Blob k={k} offset={offset} d={BLOB_4} />
      <Part k={k} offset={offset} depth={6} loop={{ period: 3800, delay: 400, y: [0, -3] }}>
        <Rect x={80} y={86} width={232} height={164} rx={20} fill={GREY} />
      </Part>
      <Part k={k} offset={offset} depth={12} loop={CARD_LOOP}>
        <Rect x={40} y={112} width={250} height={178} rx={22} fill={BLACK} />
        <Rect x={62} y={134} width={96} height={10} rx={5} fill={WHITE} />
        <Rect x={62} y={152} width={60} height={8} rx={4} fill={WHITE} fillOpacity={0.4} />
        {STAMPED.map((at) => (
          <Stamp key={`${at[0]}-${at[1]}`} at={at} />
        ))}
      </Part>
      <Part
        k={k}
        offset={offset}
        depth={12}
        origin={FREE_SPOT}
        loop={{ ...CARD_LOOP, scale: [1, 1.08], opacity: [0.55, 1] }}
      >
        <Circle
          cx={FREE_SPOT[0]}
          cy={FREE_SPOT[1]}
          r={20}
          fill="none"
          stroke={WHITE}
          strokeWidth={2}
          strokeDasharray="5 5"
        />
        <Path d={star(FREE_SPOT[0], FREE_SPOT[1], 9, 4)} fill={WHITE} />
      </Part>
      <Part k={k} offset={offset} depth={12} drop={{ from: 90, entry }} loop={CARD_LOOP}>
        <Stamp at={LAST_STAMP} />
      </Part>
      <Spark k={k} offset={offset} at={[30, 96]} size={8} delay={0} />
      <Spark k={k} offset={offset} at={[324, 76]} size={10} delay={700} color={GREY} />
      <Spark k={k} offset={offset} at={[60, 306]} size={6} delay={1300} />
      <Spark k={k} offset={offset} at={[310, 296]} size={7} delay={400} />
    </>
  );
}

// The open spot the grey player flies into, and where the player starts (smaller, top right).
const SPOT = [232, 110] as const;
const START = { x: 300 - SPOT[0], y: 46 - SPOT[1], scale: 0.8 };
const JOIN_MS = 5200;

// 3 · Short squads, solved: a grey player flies into the squad's dashed open spot, stays a beat,
// and the loop starts again.
function SquadScene({ k, offset, active }: SceneProps) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduce || !active) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    t.value = 0;
    t.value = withDelay(
      300,
      withRepeat(withTiming(1, { duration: JOIN_MS, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(t);
  }, [active, reduce, t]);

  // 0–0.3 waits at the start, 0.3–0.55 flies in, 0.55–0.82 stays, 0.82–1 fades out and comes back.
  const flight = useDerivedValue(() =>
    Easing.inOut(Easing.cubic)(interpolate(t.value, [0.3, 0.55], [0, 1], "clamp")),
  );
  const joiner = useAnimatedStyle(() => {
    const f = flight.value;
    const opacity = interpolate(t.value, [0, 0.06, 0.82, 0.92, 1], [0, 1, 1, 0, 0], "clamp");
    return {
      opacity: reduce ? 1 : opacity,
      transform: [
        { translateX: offset.value * 36 + START.x * (1 - f) * k },
        { translateY: START.y * (1 - f) * k },
        { scale: START.scale + (1 - START.scale) * f },
      ],
    };
  });
  const trail = useAnimatedStyle(() => ({
    opacity: reduce ? 1 : interpolate(t.value, [0, 0.08, 0.3, 0.4], [0, 1, 1, 0], "clamp"),
    transform: [{ translateX: offset.value * 40 }],
  }));
  const spot = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0.46, 0.55, 0.88, 0.98], [1, 0, 0, 1], "clamp"),
    transform: [{ translateX: offset.value * 18 }],
  }));
  const layer = (
    style: ReturnType<typeof useAnimatedStyle>,
    children: ReactNode,
    origin = SPOT,
  ) => (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { transformOrigin: [origin[0] * k, origin[1] * k, 0] },
        style,
      ]}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        {children}
      </Svg>
    </Animated.View>
  );

  return (
    <>
      <Blob k={k} offset={offset} d={BLOB_2} />
      <Part k={k} offset={offset} depth={18} loop={{ period: 3000, y: [0, -3] }}>
        <Player cx={112} cy={110} fill={WHITE} />
      </Part>
      {layer(spot, <Player cx={SPOT[0]} cy={SPOT[1]} open />)}
      <Part k={k} offset={offset} depth={14} loop={{ period: 3400, delay: 400, y: [0, -3] }}>
        <Player cx={72} cy={205} fill={BLACK} />
      </Part>
      <Part k={k} offset={offset} depth={14} loop={{ period: 2800, delay: 900, y: [0, -3] }}>
        <Player cx={172} cy={205} fill={WHITE} />
      </Part>
      <Part k={k} offset={offset} depth={14} loop={{ period: 3200, delay: 200, y: [0, -3] }}>
        <Player cx={272} cy={205} fill={BLACK} />
      </Part>
      {layer(
        trail,
        <Path
          d="M343 4 C338 22 328 32 316 38"
          stroke={BLACK}
          strokeOpacity={0.35}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        />,
      )}
      {layer(joiner, <Player cx={SPOT[0]} cy={SPOT[1]} fill={GREY} />)}
      <Part
        k={k}
        offset={offset}
        depth={26}
        origin={[122, 300]}
        loop={{ period: 1400, y: [0, -10], rotate: [0, 40] }}
      >
        <Circle cx={122} cy={300} r={20} fill={WHITE} />
        <Path d={star(122, 300, 9.5, 7.7)} fill={BLACK} />
      </Part>
      <Spark k={k} offset={offset} at={[30, 150]} size={8} delay={200} />
      <Spark k={k} offset={offset} at={[322, 150]} size={10} delay={900} />
      <Spark k={k} offset={offset} at={[230, 300]} size={6} delay={1500} />
      <Spark k={k} offset={offset} at={[178, 40]} size={6} delay={600} />
    </>
  );
}

// Confetti pieces: shape, colour, and how each one drifts.
const CONFETTI: {
  d?: string;
  circle?: readonly [number, number, number];
  fill: string;
  loop: Loop;
  origin: readonly [number, number];
}[] = [
  {
    d: "M52 80 l14 -6 l4 9 l-14 6Z",
    fill: BLACK,
    origin: [61, 81],
    loop: { period: 3000, y: [-4, 6], rotate: [-25, 20] },
  },
  {
    d: "M280 58 l10 10 l-7 7 l-10 -10Z",
    fill: GREY,
    origin: [281, 66],
    loop: { period: 3600, delay: 500, y: [-5, 5], rotate: [20, -30] },
  },
  {
    d: "M296 210 l14 4 l-3 9 l-14 -4Z",
    fill: BLACK,
    origin: [301, 216],
    loop: { period: 3300, delay: 900, y: [-3, 7], rotate: [-15, 25] },
  },
  {
    d: "M40 232 l8 -12 l8 5 l-8 12Z",
    fill: BLACK,
    origin: [48, 231],
    loop: { period: 2800, delay: 300, y: [5, -5], rotate: [30, -10] },
  },
  {
    circle: [96, 44, 5],
    fill: WHITE,
    origin: [96, 44],
    loop: { period: 2600, delay: 700, y: [-4, 4] },
  },
  {
    circle: [316, 124, 5],
    fill: WHITE,
    origin: [316, 124],
    loop: { period: 3100, delay: 1100, y: [4, -4] },
  },
  {
    circle: [64, 160, 4],
    fill: GREY,
    origin: [64, 160],
    loop: { period: 2900, delay: 200, y: [-3, 5] },
  },
];

// 4 · Kickabout crews, crowned: an all-black cup with a white star springs up when the slide lands, then sways gently in
// floating confetti.
function TrophyScene({ k, offset, active }: SceneProps) {
  const entry = useEntry(active);
  return (
    <>
      <Blob k={k} offset={offset} d={BLOB_3} />
      <Part
        k={k}
        offset={offset}
        depth={14}
        origin={[172, 282]}
        drop={{ from: -24, entry }}
        loop={{ period: 3600, delay: 800, rotate: [-2, 2] }}
      >
        <Path
          d="M116 112 C70 112 72 172 128 182"
          stroke={BLACK}
          strokeWidth={14}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M228 112 C274 112 272 172 216 182"
          stroke={BLACK}
          strokeWidth={14}
          strokeLinecap="round"
          fill="none"
        />
        <Rect x={160} y={200} width={24} height={38} fill={BLACK} />
        <Path d="M112 92 H232 V148 A60 60 0 0 1 112 148 Z" fill={BLACK} />
        <Rect x={104} y={82} width={136} height={16} rx={8} fill={BLACK} />
        <Path d={star(172, 142, 22, 9)} fill={WHITE} />
        <Rect x={134} y={234} width={76} height={20} rx={6} fill={BLACK} />
        <Rect x={114} y={252} width={116} height={30} rx={10} fill={BLACK} />
      </Part>
      {CONFETTI.map((piece, i) => (
        <Part key={i} k={k} offset={offset} depth={30} origin={piece.origin} loop={piece.loop}>
          {piece.d ? (
            <Path d={piece.d} fill={piece.fill} />
          ) : (
            <Circle
              cx={piece.circle![0]}
              cy={piece.circle![1]}
              r={piece.circle![2]}
              fill={piece.fill}
            />
          )}
        </Part>
      ))}
      <Spark k={k} offset={offset} at={[250, 40]} size={10} delay={0} />
      <Spark k={k} offset={offset} at={[36, 118]} size={7} delay={800} />
      <Spark k={k} offset={offset} at={[300, 270]} size={8} delay={400} />
      <Spark k={k} offset={offset} at={[70, 290]} size={6} delay={1200} />
    </>
  );
}

const SCENES = {
  pitches: PitchScene,
  free: LoyaltyScene,
  squads: SquadScene,
  crews: TrophyScene,
};
export type OnboardingScene = keyof typeof SCENES;

interface OnboardingArtProps {
  // Which slide this is, and the pager's scroll position, for the parallax.
  index: number;
  scene: OnboardingScene;
  scrollX: SharedValue<number>;
  pageWidth: number;
  active: boolean;
}

// Fills the space it's given, keeping the canvas's proportions, centred.
export function OnboardingArt({ index, scene, scrollX, pageWidth, active }: OnboardingArtProps) {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const offset = useDerivedValue(() => scrollX.value / pageWidth - index);
  const Scene = SCENES[scene];
  const k = box ? Math.min(box.width / W, box.height / H) : 0;

  return (
    <View
      className="flex-1 items-center justify-center"
      onLayout={(e) => setBox(e.nativeEvent.layout)}
    >
      {k > 0 ? (
        <View style={{ width: W * k, height: H * k }}>
          <Scene k={k} offset={offset} active={active} />
        </View>
      ) : null}
    </View>
  );
}
