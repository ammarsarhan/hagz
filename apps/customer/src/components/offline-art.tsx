import { View } from "react-native";
import { interpolate, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { Layer, LIGHTS_OUT_SIZE, useLoop } from "./lights-out-art";

// "Unplugged", the no-connection scene (PageState): the pitch from Lights out, a scoreboard reading
// "– : –" on its legs, and its cable's plug floating just short of the socket beside it. Black,
// white and grey only, on the faint black blob, like every customer illustration. 280 × 220, the
// same canvas as Lights out so it shares its moving-layer helpers.
//
// The plug drifts toward the socket and back, never quite reaching it, and two sparkles twinkle;
// each is its own rasterised layer. Still with Reduce Motion on.

const { width: W, height: H } = LIGHTS_OUT_SIZE;
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

// `scale` shrinks the whole scene (layers too) into a smaller box, for a page short on room.
export function OfflineArt({ scale = 1 }: { scale?: number }) {
  const reach = useLoop(4200);
  const bob = useLoop(5600, 600);
  const twinkle = useLoop(3200, 900);

  // Toward the socket and back, with a slight bob: it never closes the gap.
  const plug = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(reach.value, [0, 1], [-3, 4]) },
      { translateY: interpolate(bob.value, [0, 1], [-2, 2]) },
    ],
  }));
  const sparks = useAnimatedStyle(() => ({
    opacity: interpolate(twinkle.value, [0, 1], [1, 0.5]),
    transform: [{ translateY: interpolate(bob.value, [0, 1], [4, -4]) }],
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
          {/* The scoreboard on its legs, its score gone: a dash each side of the colon. */}
          <Rect x={92} y={120} width={8} height={50} rx={3} fill={BLACK} />
          <Rect x={180} y={120} width={8} height={50} rx={3} fill={BLACK} />
          <Rect x={60} y={44} width={160} height={84} rx={14} fill={BLACK} />
          <Rect x={76} y={58} width={48} height={56} rx={8} fill={GREY} />
          <Rect x={156} y={58} width={48} height={56} rx={8} fill={GREY} />
          <Rect x={88} y={83} width={24} height={6} rx={3} fill={WHITE} />
          <Rect x={168} y={83} width={24} height={6} rx={3} fill={WHITE} />
          <Circle cx={140} cy={76} r={4} fill={WHITE} />
          <Circle cx={140} cy={96} r={4} fill={WHITE} />
          {/* The socket it should be plugged into. */}
          <Rect
            x={246}
            y={136}
            width={18}
            height={26}
            rx={5}
            fill={WHITE}
            stroke={BLACK}
            strokeWidth={3}
          />
          <Rect x={252} y={143} width={6} height={3} rx={1.5} fill={BLACK} />
          <Rect x={252} y={152} width={6} height={3} rx={1.5} fill={BLACK} />
        </Svg>
        {/* The cable from the scoreboard and its plug, drifting short of the socket. */}
        <Layer style={plug}>
          <Path
            d="M220 100 C246 104 196 150 216 149"
            stroke={BLACK}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
          <Rect x={214} y={141} width={18} height={16} rx={4} fill={BLACK} />
          <Rect x={231} y={144} width={8} height={3} rx={1.5} fill={BLACK} />
          <Rect x={231} y={151} width={8} height={3} rx={1.5} fill={BLACK} />
        </Layer>
        <Layer style={sparks}>
          <Path d={spark(40, 70, 8)} fill={BLACK} />
          <Path d={spark(236, 40, 5)} fill={GREY} />
        </Layer>
      </View>
    </View>
  );
}
