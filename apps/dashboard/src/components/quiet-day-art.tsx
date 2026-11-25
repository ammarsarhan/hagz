import { View } from "react-native";
import { interpolate, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { Layer, SCENE_SIZE, useLoop } from "./scene-layer";

// "Quiet day", the Calendar's scene for a day gone by with nothing booked: a calendar page standing
// on a pitch, its rows empty (dashed, as free hours are), and a ball beside it giving little
// bounces with nobody to kick it. Black, white and grey on a faint black blob, like Unplugged
// (offline-art.tsx). 280 × 220 (scene-layer.tsx).
//
// The ball and two sparkles move, each its own rasterised layer. Still with Reduce Motion on.

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

// The page's empty rows: a grey stub for the time and a dashed bar where a booking would be.
const ROWS = [80, 104, 128];

// `scale` shrinks the whole scene (layers too) into a smaller box, for a page short on room.
export function QuietDayArt({ scale = 1 }: { scale?: number }) {
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
          {/* The calendar page standing on it: a black frame, its rings, the day as a white bar. */}
          <Rect x={70} y={38} width={124} height={132} rx={14} fill={BLACK} />
          <Rect x={96} y={28} width={8} height={20} rx={4} fill={GREY} />
          <Rect x={160} y={28} width={8} height={20} rx={4} fill={GREY} />
          <Rect x={110} y={52} width={44} height={6} rx={3} fill={WHITE} />
          <Rect x={80} y={68} width={104} height={92} rx={8} fill={WHITE} />
          {ROWS.map((y) => (
            <G key={y}>
              <Rect x={90} y={y + 4} width={14} height={6} rx={3} fill={GREY} />
              <Rect
                x={112}
                y={y}
                width={62}
                height={14}
                rx={4}
                fill="none"
                stroke={GREY}
                strokeWidth={2}
                strokeDasharray="4 3"
              />
            </G>
          ))}
        </Svg>
        {/* The ball beside it, bouncing a little on the spot. */}
        <Layer style={ball}>
          <Circle cx={225} cy={148} r={19} fill={WHITE} stroke={BLACK} strokeWidth={3} />
          <Path d="M225 140 L232.6 145.5 L229.7 154.5 L220.3 154.5 L217.4 145.5Z" fill={BLACK} />
          <Path
            d="M225 140 L225 130 M232.6 145.5 L242 142 M229.7 154.5 L235.5 162.5 M220.3 154.5 L214.5 162.5 M217.4 145.5 L208 142"
            stroke={BLACK}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </Layer>
        <Layer style={sparks}>
          <Path d={spark(42, 74, 8)} fill={BLACK} />
          <Path d={spark(232, 52, 5)} fill={GREY} />
        </Layer>
      </View>
    </View>
  );
}
