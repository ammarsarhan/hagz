import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

// "Lights out", Search's empty state when no venue matches (Figma "C3 · Tabs & Search", section
// "Search · No venues match", option C, 114:2; the user's pick on 2026-11-20): a floodlight with
// its lamps off under a moon, and a lone ball waiting on the pitch. Customer illustrations are
// black, white and grey only, on a faint black blob (as the onboarding art). 280 × 220.

const BLACK = "#000000";
const GREY = "#8E8E8E";
const WHITE = "#FFFFFF";

export const LIGHTS_OUT_SIZE = { width: 280, height: 220 } as const;

const BLOB =
  "M232.5 141.8 Q222.1 171.7 196.2 188.3 Q170.2 204.9 141.5 200.3 Q112.8 195.6 81.4 186.5 Q50.0 177.4 48.4 144.7 Q46.9 112.0 55.2 84.2 Q63.5 56.4 86.6 37.5 Q109.6 18.5 141.5 13.9 Q173.4 9.2 191.0 35.7 Q208.5 62.2 225.7 87.1 Q242.9 112.0 232.5 141.8Z";
const SPARK_BIG =
  "M236 101 C237.26 106.74 237.26 106.74 243 108 C237.26 109.26 237.26 109.26 236 115 C234.74 109.26 234.74 109.26 229 108 C234.74 106.74 234.74 106.74 236 101Z";
const SPARK_SMALL =
  "M150 29 C150.9 33.1 150.9 33.1 155 34 C150.9 34.9 150.9 34.9 150 39 C149.1 34.9 149.1 34.9 145 34 C149.1 33.1 149.1 33.1 150 29Z";

export function LightsOutArt() {
  return (
    <Svg
      width={LIGHTS_OUT_SIZE.width}
      height={LIGHTS_OUT_SIZE.height}
      viewBox={`0 0 ${LIGHTS_OUT_SIZE.width} ${LIGHTS_OUT_SIZE.height}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d={BLOB} fill={BLACK} fillOpacity={0.07} />
      {/* The moon: a grey disc with a white one over most of it. */}
      <Circle cx={206} cy={58} r={22} fill={GREY} />
      <Circle cx={216} cy={50} r={20} fill={WHITE} />
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
      <Path d={SPARK_BIG} fill={BLACK} />
      <Path d={SPARK_SMALL} fill={GREY} />
    </Svg>
  );
}
