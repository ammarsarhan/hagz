import type { ReactNode } from "react";
import { View } from "react-native";
import { interpolate, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { Layer, SCENE_SIZE, useLoop } from "./scene-layer";

// Scenes for lists with nothing in them yet, in Quiet day's family (quiet-day-art.tsx): black,
// white and grey on a faint black blob, standing on a pitch, with the ball beside giving little
// bounces and two sparkles drifting. 280 × 220 (scene-layer.tsx). Still with Reduce Motion on.
//
// - NoWeeklyArt (Regulars): a week as seven days, one of them a dashed ring, the time kept free
//   for a regular, over a dashed bar where the weekly game would go.
// - NoCustomersArt (Customers): a contact card, its number a dashed bar still to fill.

const { width: W, height: H } = SCENE_SIZE;
const BLACK = "#000000";
const GREY = "#8E8E8E";
const WHITE = "#FFFFFF";

const BLOB =
  "M232.5 141.8 Q222.1 171.7 196.2 188.3 Q170.2 204.9 141.5 200.3 Q112.8 195.6 81.4 186.5 Q50.0 177.4 48.4 144.7 Q46.9 112.0 55.2 84.2 Q63.5 56.4 86.6 37.5 Q109.6 18.5 141.5 13.9 Q173.4 9.2 191.0 35.7 Q208.5 62.2 225.7 87.1 Q242.9 112.0 232.5 141.8Z";

// A four-pointed sparkle centred on (x, y), `r` from its middle to a point.
const spark = (x: number, y: number, r: number) => {
  const k = r * 0.18;
  return `M${x} ${y - r} C${x + k} ${y - k} ${x + k} ${y - k} ${x + r} ${y} C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + r} C${x - k} ${y + k} ${x - k} ${y + k} ${x - r} ${y} C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - r}Z`;
};

// The week's days across the card; the fifth is the free one.
const DAYS = [57, 77, 97, 117, 137, 157, 177];
const FREE_DAY = 4;

export function NoWeeklyArt({ scale = 1 }: { scale?: number }) {
  return (
    <Scene scale={scale}>
      {/* The week, standing on the pitch: a black card, its title as a white bar. */}
      <Rect x={40} y={60} width={154} height={108} rx={16} fill={BLACK} />
      <Rect x={56} y={76} width={52} height={6} rx={3} fill={WHITE} />
      {DAYS.map((x, index) =>
        index === FREE_DAY ? (
          <Circle
            key={x}
            cx={x}
            cy={106}
            r={7}
            fill="none"
            stroke={WHITE}
            strokeWidth={2}
            strokeDasharray="3 2.5"
          />
        ) : (
          <Circle key={x} cx={x} cy={106} r={7} fill={index < FREE_DAY ? GREY : WHITE} />
        ),
      )}
      <Rect
        x={56}
        y={128}
        width={122}
        height={22}
        rx={6}
        fill="none"
        stroke={WHITE}
        strokeWidth={2}
        strokeDasharray="5 4"
      />
    </Scene>
  );
}

export function NoCustomersArt({ scale = 1 }: { scale?: number }) {
  return (
    <Scene scale={scale}>
      {/* A contact card standing on the pitch: someone, their name, a number still to add. */}
      <Rect x={58} y={44} width={132} height={124} rx={16} fill={BLACK} />
      <Circle cx={124} cy={82} r={22} fill={WHITE} />
      <Circle cx={124} cy={76} r={7.5} fill={BLACK} />
      <Path d="M110 97 C112 87 136 87 138 97 Z" fill={BLACK} />
      <Rect x={98} y={116} width={52} height={6} rx={3} fill={WHITE} />
      <Rect
        x={80}
        y={132}
        width={88}
        height={20}
        rx={6}
        fill="none"
        stroke={WHITE}
        strokeWidth={2}
        strokeDasharray="5 4"
      />
    </Scene>
  );
}

// The blob, the pitch and what stands on it, then the ball and sparkles moving on their own layers.
// `scale` shrinks the whole scene into a smaller box, for a page short on room.
function Scene({ scale, children }: { scale: number; children: ReactNode }) {
  const bounce = useLoop(1600);
  const twinkle = useLoop(3200, 900);
  const drift = useLoop(5600, 600);

  const ball = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(bounce.value, [0, 1], [0, -10]) }],
  }));
  const sparks = useAnimatedStyle(() => ({
    opacity: interpolate(twinkle.value, [0, 1], [1, 0.5]),
    transform: [{ translateY: interpolate(drift.value, [0, 1], [4, -4]) }],
  }));

  return (
    <View
      style={{ width: W * scale, height: H * scale }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Drawn at full size and scaled about its middle into the box. */}
      <View
        style={{
          position: "absolute",
          width: W,
          height: H,
          left: (W * scale - W) / 2,
          top: (H * scale - H) / 2,
          transform: [{ scale }],
        }}
      >
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <Path d={BLOB} fill={BLACK} fillOpacity={0.07} />
          {/* The pitch, with its halfway line. */}
          <Rect x={34} y={168} width={212} height={34} rx={12} fill={BLACK} />
          <Rect x={139} y={168} width={2} height={34} fill={WHITE} />
          {children}
        </Svg>
        <Layer style={ball}>
          <Circle cx={228} cy={148} r={19} fill={WHITE} stroke={BLACK} strokeWidth={3} />
          <Path d="M228 140 L235.6 145.5 L232.7 154.5 L223.3 154.5 L220.4 145.5Z" fill={BLACK} />
          <Path
            d="M228 140 L228 130 M235.6 145.5 L245 142 M232.7 154.5 L238.5 162.5 M223.3 154.5 L217.5 162.5 M220.4 145.5 L211 142"
            stroke={BLACK}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </Layer>
        <Layer style={sparks}>
          <Path d={spark(34, 70, 8)} fill={BLACK} />
          <Path d={spark(236, 52, 5)} fill={GREY} />
        </Layer>
      </View>
    </View>
  );
}
