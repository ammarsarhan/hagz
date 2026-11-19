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
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// The four onboarding illustrations from the approved Figma slides (customer file
// YdkY80zjQpKEBCIcxDsxCq, page "C1 · Auth", section "Onboarding · slideshow"), drawn on a 345 × 330
// canvas and animated.
//
// Kept light on purpose: everything that stands still is drawn once in a single Svg, and only the
// few moving parts get a layer of their own (a full-canvas Svg in an Animated.View, rasterised, so
// motion is a native transform of a cached bitmap; react-native-svg's own transform props become a
// matrix in JavaScript, which animated props would skip). Loops run only on the slide on screen,
// the whole drawing drifts a little with the swipe, and intros ease in once with no overshoot. With
// Reduce Motion on, the drawings stand still.
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

// A soft back-and-forth between two values, 0 → 1 → 0, while the slide is on screen.
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

const EASE_LOOP = Easing.inOut(Easing.sin);

// The main object on each slide floats on this; parts that sit on it (the pin, the stamps) use the
// same loop so they move together.
const FLOAT: Loop = { period: 6400, y: [-5, 5] };
const EASE_IN_PLACE = Easing.out(Easing.cubic);

// Everything in a scene that doesn't move, drawn once.
function Still({ children }: { children: ReactNode }) {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`}>
      {children}
    </Svg>
  );
}

function Layer({
  k,
  origin = [W / 2, H / 2],
  style,
  children,
}: {
  k: number;
  origin?: readonly [number, number];
  style: ReturnType<typeof useAnimatedStyle>;
  children: ReactNode;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      shouldRasterizeIOS
      renderToHardwareTextureAndroid
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

// Runs a loop's 0 → 1 → 0 only while `active`, and parks it at 0 otherwise.
function useLoop(loop: Loop | undefined, active: boolean) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  const period = loop?.period;
  const delay = loop?.delay ?? 0;
  useEffect(() => {
    if (!period || reduce || !active) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: period / 2, easing: EASE_LOOP }), -1, true),
    );
    return () => cancelAnimation(t);
  }, [period, delay, reduce, active, t]);
  return t;
}

// Eases from 0 to 1 the first time the slide lands, and never again: coming back to the slide finds
// the part already in place.
function useEntry(active: boolean) {
  const reduce = useReducedMotion();
  const entry = useSharedValue(reduce ? 1 : 0);
  const played = useRef(false);
  useEffect(() => {
    if (reduce) entry.value = 1;
    else if (active && !played.current) {
      played.current = true;
      entry.value = withDelay(150, withTiming(1, { duration: 650, easing: EASE_IN_PLACE }));
    }
  }, [active, reduce, entry]);
  return entry;
}

interface PartProps {
  k: number;
  active: boolean;
  loop?: Loop;
  // Comes into place from this many canvas units above (negative: below) the first time the slide
  // lands.
  drop?: { from: number; entry: SharedValue<number> };
  // The point it rotates and scales around, in canvas units.
  origin?: readonly [number, number];
  children: ReactNode;
}

function Part({ k, active, loop, drop, origin, children }: PartProps) {
  const t = useLoop(loop, active);
  const style = useAnimatedStyle(() => {
    const p = t.value;
    const at = (range: Range | undefined, rest: number) =>
      range ? range[0] + (range[1] - range[0]) * p : rest;
    const entry = drop ? drop.entry.value : 1;
    return {
      opacity: at(loop?.opacity, 1) * (drop ? Math.min(1, entry * 1.6) : 1),
      transform: [
        { translateX: at(loop?.x, 0) * k },
        { translateY: (at(loop?.y, 0) - (drop ? drop.from * (1 - entry) : 0)) * k },
        { rotate: `${at(loop?.rotate, 0)}deg` },
        { scale: at(loop?.scale, 1) },
      ],
    };
  });
  return (
    <Layer k={k} origin={origin} style={style}>
      {children}
    </Layer>
  );
}

// A scene's sparkles, twinkling together in one layer.
function Sparks({
  k,
  active,
  at,
}: {
  k: number;
  active: boolean;
  at: readonly (readonly [number, number, number, string?])[];
}) {
  return (
    <Part k={k} active={active} loop={{ period: 3200, opacity: [0.35, 1] }}>
      {at.map(([x, y, size, color], i) => (
        <Path key={i} d={spark(x, y, size)} fill={color ?? BLACK} />
      ))}
    </Part>
  );
}

interface SceneProps {
  k: number;
  active: boolean;
}

const BLOB_1 = blob(172, 190, [138, 128, 145, 132, 140, 126, 146, 134, 130, 142], 0.3);
const BLOB_2 = blob(172, 180, [134, 144, 128, 140, 132, 146, 130, 138, 142, 128], 1.1);
const BLOB_3 = blob(172, 180, [140, 130, 146, 128, 142, 134, 138, 126, 144, 132], 0.6);
const BLOB_4 = blob(172, 185, [136, 146, 130, 142, 128, 144, 134, 140, 126, 138], 0.9);

const Blob = ({ d }: { d: string }) => <Path d={d} fill={BLOB} fillOpacity={BLOB_OPACITY} />;

// 1 · Pitch hunting, handled: a pin comes down onto a floating pitch while free slots drift around
// it.
function PitchScene({ k, active }: SceneProps) {
  const entry = useEntry(active);
  return (
    <>
      <Still>
        <Blob d={BLOB_1} />
      </Still>
      <Part k={k} active={active} loop={FLOAT}>
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
      {/* Two groups of slots, floating against each other. */}
      <Part k={k} active={active} loop={{ period: 7000, x: [-2, 2], y: [-7, 7] }}>
        <Rect x={30} y={96} width={66} height={30} rx={15} fill={WHITE} />
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
      <Part k={k} active={active} loop={{ period: 7800, delay: 400, x: [2, -2], y: [7, -7] }}>
        <Path
          d="M330 22 C340 44 330 64 312 74"
          stroke={BLACK}
          strokeOpacity={0.35}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        />
        <Rect x={250} y={78} width={66} height={30} rx={15} fill={GREY} />
        <Rect x={24} y={292} width={66} height={30} rx={15} fill={BLACK} />
      </Part>
      <Part k={k} active={active} drop={{ from: 40, entry }} loop={FLOAT}>
        <Path
          d="M172 214 C160 194 138 168 138 136 A34 34 0 1 1 206 136 C206 168 184 194 172 214Z"
          fill={WHITE}
        />
        <Circle cx={172} cy={135} r={13} fill={BLACK} />
      </Part>
      <Sparks
        k={k}
        active={active}
        at={[
          [40, 196, 9],
          [314, 176, 11, GREY],
          [124, 62, 6],
          [306, 246, 6],
        ]}
      />
    </>
  );
}

// A venue's punch card, with the same 22 of padding above the title and below the stamps: stamps
// for the bookings played, the last one landing, and the free booking waiting in the final spot.
const STAMPED = [
  [92, 200],
  [165, 200],
  [238, 200],
  [92, 248],
] as const;
const LAST_STAMP = [165, 248] as const;
const FREE_SPOT = [238, 248] as const;

function Stamp({ at }: { at: readonly [number, number] }) {
  return (
    <>
      <Circle cx={at[0]} cy={at[1]} r={20} fill={WHITE} />
      <Path d={star(at[0], at[1], 8, 6.5)} fill={BLACK} />
    </>
  );
}

// 2 · Frequent fixtures, free: the last stamp comes down onto the card the first time the slide
// lands, and the free booking's spot glows softly.
function LoyaltyScene({ k, active }: SceneProps) {
  const entry = useEntry(active);
  return (
    <>
      <Still>
        <Blob d={BLOB_4} />
      </Still>
      {/* The card behind floats slower and the other way, for a little depth. */}
      <Part k={k} active={active} loop={{ period: 7600, x: [1.5, -1.5], y: [4, -4] }}>
        <Rect x={80} y={86} width={232} height={164} rx={20} fill={GREY} />
      </Part>
      <Part k={k} active={active} loop={FLOAT}>
        <Rect x={40} y={112} width={250} height={178} rx={22} fill={BLACK} />
        <Rect x={62} y={134} width={96} height={10} rx={5} fill={WHITE} />
        <Rect x={62} y={152} width={60} height={8} rx={4} fill={WHITE} fillOpacity={0.4} />
        {STAMPED.map((at) => (
          <Stamp key={`${at[0]}-${at[1]}`} at={at} />
        ))}
      </Part>
      <Part k={k} active={active} loop={{ ...FLOAT, opacity: [0.45, 1] }}>
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
      <Part k={k} active={active} drop={{ from: 50, entry }} loop={FLOAT}>
        <Stamp at={LAST_STAMP} />
      </Part>
      <Sparks
        k={k}
        active={active}
        at={[
          [30, 96, 8],
          [324, 76, 10, GREY],
          [60, 306, 6],
          [310, 296, 7],
        ]}
      />
    </>
  );
}

// The open spot the grey player walks into, and where the player starts (smaller, top right).
const SPOT = [232, 110] as const;
const START = { x: 300 - SPOT[0], y: 46 - SPOT[1], scale: 0.8 };
const JOIN_MS = 6400;

// 3 · Short squads, solved: a grey player glides into the squad's dashed open spot, stays a beat,
// and the loop starts again.
function SquadScene({ k, active }: SceneProps) {
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

  // 0–0.25 waits at the start, 0.25–0.5 glides in, 0.5–0.82 stays, 0.82–1 fades out and comes
  // back.
  const flight = useDerivedValue(() =>
    Easing.inOut(Easing.quad)(interpolate(t.value, [0.25, 0.5], [0, 1], "clamp")),
  );
  const joiner = useAnimatedStyle(() => {
    const f = flight.value;
    const opacity = interpolate(t.value, [0, 0.06, 0.82, 0.92, 1], [0, 1, 1, 0, 0], "clamp");
    return {
      opacity: reduce ? 1 : opacity,
      transform: [
        { translateX: START.x * (1 - f) * k },
        { translateY: START.y * (1 - f) * k },
        { scale: START.scale + (1 - START.scale) * f },
      ],
    };
  });
  const trail = useAnimatedStyle(() => ({
    opacity: reduce ? 1 : interpolate(t.value, [0, 0.08, 0.25, 0.35], [0, 1, 1, 0], "clamp"),
  }));
  const spot = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0.42, 0.5, 0.88, 0.98], [1, 0, 0, 1], "clamp"),
  }));

  return (
    <>
      <Still>
        <Blob d={BLOB_2} />
      </Still>
      {/* The squad floats in two groups, against each other. */}
      <Part k={k} active={active} loop={{ period: 6400, y: [-4, 4] }}>
        <Player cx={112} cy={110} fill={WHITE} />
        <Player cx={172} cy={205} fill={WHITE} />
      </Part>
      <Part k={k} active={active} loop={{ period: 7200, delay: 500, y: [4, -4] }}>
        <Player cx={72} cy={205} fill={BLACK} />
        <Player cx={272} cy={205} fill={BLACK} />
      </Part>
      <Layer k={k} style={spot}>
        <Player cx={SPOT[0]} cy={SPOT[1]} open />
      </Layer>
      <Layer k={k} style={trail}>
        <Path
          d="M343 4 C338 22 328 32 316 38"
          stroke={BLACK}
          strokeOpacity={0.35}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        />
      </Layer>
      <Layer k={k} origin={SPOT} style={joiner}>
        <Player cx={SPOT[0]} cy={SPOT[1]} fill={GREY} />
      </Layer>
      <Part
        k={k}
        active={active}
        origin={[122, 300]}
        loop={{ period: 4200, y: [3, -8], rotate: [-12, 12] }}
      >
        <Circle cx={122} cy={300} r={20} fill={WHITE} />
        <Path d={star(122, 300, 9.5, 7.7)} fill={BLACK} />
      </Part>
      <Sparks
        k={k}
        active={active}
        at={[
          [30, 150, 8],
          [322, 150, 10],
          [230, 300, 6],
          [178, 40, 6],
        ]}
      />
    </>
  );
}

// 4 · Kickabout crews, crowned: an all-black cup with a white star rises into place the first time
// the slide lands, then sways very slightly among drifting confetti.
function TrophyScene({ k, active }: SceneProps) {
  const entry = useEntry(active);
  return (
    <>
      <Still>
        <Blob d={BLOB_3} />
      </Still>
      <Part
        k={k}
        active={active}
        origin={[172, 282]}
        drop={{ from: -16, entry }}
        loop={{ ...FLOAT, rotate: [-1.5, 1.5] }}
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
        {/* A collar halfway down the stem. */}
        <Rect x={150} y={212} width={44} height={10} rx={5} fill={BLACK} />
        <Path d="M112 92 H232 V148 A60 60 0 0 1 112 148 Z" fill={BLACK} />
        <Rect x={104} y={82} width={136} height={16} rx={8} fill={BLACK} />
        {/* The lip under the rim, and the star. */}
        <Rect x={112} y={98} width={120} height={3} fill={WHITE} fillOpacity={0.25} />
        <Path d={star(172, 142, 18, 7.5)} fill={WHITE} />
        <Rect x={134} y={234} width={76} height={20} rx={6} fill={BLACK} />
        <Rect x={114} y={252} width={116} height={30} rx={10} fill={BLACK} />
        {/* Where the base's tiers meet, and the nameplate. */}
        <Rect x={138} y={234} width={68} height={2} fill={WHITE} fillOpacity={0.25} />
        <Rect x={120} y={252} width={104} height={2} fill={WHITE} fillOpacity={0.25} />
        <Rect x={142} y={260} width={60} height={14} rx={3} fill={GREY} />
      </Part>
      {/* Confetti in two groups, drifting against each other. */}
      <Part k={k} active={active} loop={{ period: 6600, x: [-3, 3], y: [-9, 9] }}>
        <Path d="M52 80 l14 -6 l4 9 l-14 6Z" fill={BLACK} />
        <Path d="M296 210 l14 4 l-3 9 l-14 -4Z" fill={BLACK} />
        <Circle cx={96} cy={44} r={5} fill={WHITE} />
        <Circle cx={64} cy={160} r={4} fill={GREY} />
      </Part>
      <Part k={k} active={active} loop={{ period: 7400, delay: 700, x: [3, -3], y: [9, -9] }}>
        <Path d="M280 58 l10 10 l-7 7 l-10 -10Z" fill={GREY} />
        <Path d="M40 232 l8 -12 l8 5 l-8 12Z" fill={BLACK} />
        <Circle cx={316} cy={124} r={5} fill={WHITE} />
      </Part>
      <Sparks
        k={k}
        active={active}
        at={[
          [250, 40, 10],
          [36, 118, 7],
          [300, 270, 8],
          [70, 290, 6],
        ]}
      />
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
  // Which slide this is, and the pager's scroll position, for the drift with the swipe.
  index: number;
  scene: OnboardingScene;
  scrollX: SharedValue<number>;
  pageWidth: number;
  active: boolean;
}

// How far the drawing lags behind its slide during a swipe, in points per page.
const DRIFT = 28;

// Fills the space it's given, keeping the canvas's proportions, centred.
export function OnboardingArt({ index, scene, scrollX, pageWidth, active }: OnboardingArtProps) {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const Scene = SCENES[scene];
  const k = box ? Math.min(box.width / W, box.height / H) : 0;
  const drift = useAnimatedStyle(() => ({
    transform: [{ translateX: (scrollX.value / pageWidth - index) * DRIFT }],
  }));

  return (
    <View
      className="flex-1 items-center justify-center"
      onLayout={(e) => setBox(e.nativeEvent.layout)}
    >
      {k > 0 ? (
        <Animated.View style={[{ width: W * k, height: H * k }, drift]}>
          <Scene k={k} active={active} />
        </Animated.View>
      ) : null}
    </View>
  );
}
