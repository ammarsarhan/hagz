import { useId, type ReactNode } from "react";
import { View } from "react-native";
import Animated, {
  LayoutAnimationConfig,
  LinearTransition,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import Svg, { Circle, ClipPath, Defs, G, Line } from "react-native-svg";
import { colors } from "@/lib/colors";
import { Text } from "./text";

// An open game's spots (Figma C11, the signature): the booker as an outlined disc, each player
// who's joined black with their initial, each spot still open dashed. A player whose name isn't
// shown yet (until you join) is hatched in grey: there, but not who.

const OPEN = "#b5b9bf";
// The hatching, faint: someone's there, but quieter than a named player.
const HATCH = 0.35;

// A change after it's shown (a player joins or is removed, the spots needed go up or down): the disc
// that comes scales in, the one that goes scales out, and the rest slide to their places, across a
// wrap too. Nothing animates as the row first appears or goes with its page.
const ENTER = ZoomIn.duration(220);
const EXIT = ZoomOut.duration(160);
const MOVE = LinearTransition.duration(220);

function Disc({ children }: { children: ReactNode }) {
  return (
    <Animated.View entering={ENTER} exiting={EXIT} layout={MOVE}>
      {children}
    </Animated.View>
  );
}

export function SpotsRow({
  booker,
  joined,
  names,
  open,
  size = 22,
  max,
}: {
  booker: string;
  joined: number;
  // The joined players' first names, when they may be shown.
  names: string[] | null;
  open: number;
  size?: number;
  // At most this many discs, on one line: past it, the last is "+N" for the rest (Home's game
  // cards, which a second line would make taller than the others in the rail). Unset: all, wrapping.
  max?: number;
}) {
  // Over the limit: keep the booker and the first players and spots, and count the rest.
  const over = max !== undefined && 1 + joined + open > max;
  const room = over ? max - 2 : Infinity; // Discs after the booker, before "+N".
  const shownJoined = Math.min(joined, room);
  const shownOpen = Math.min(open, room - shownJoined);
  const rest = joined + open - shownJoined - shownOpen;
  const disc = { width: size, height: size, borderRadius: size / 2 };
  const letter = `${size >= 30 ? "text-[13px]" : "text-[10px]"} font-semibold`;
  const initial = (name: string) => name.trim().charAt(0).toUpperCase();
  // Named discs keyed by the name (and which of that name), so a removed player's disc is the one
  // that goes, not the last; hatched ones by their place.
  const seen = new Map<string, number>();
  const keyOf = (i: number) => {
    const name = names?.[i];
    if (!name) return `j${i}`;
    const nth = (seen.get(name) ?? 0) + 1;
    seen.set(name, nth);
    return `n${name}${nth}`;
  };
  return (
    // Wraps onto more lines for a big game (an 11-a-side has 22 discs).
    <LayoutAnimationConfig skipEntering skipExiting>
      <View
        className={`flex-row ${max === undefined ? "flex-wrap" : ""}`}
        style={{ gap: size >= 30 ? 6 : 4 }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View className="items-center justify-center border border-ink bg-white" style={disc}>
          <Text className={letter}>{initial(booker)}</Text>
        </View>
        {Array.from({ length: shownJoined }, (_, i) => (
          <Disc key={keyOf(i)}>
            {names?.[i] ? (
              <View className="items-center justify-center bg-ink" style={disc}>
                <Text className={`${letter} text-white`}>{initial(names[i])}</Text>
              </View>
            ) : (
              <Hatched size={size} />
            )}
          </Disc>
        ))}
        {Array.from({ length: shownOpen }, (_, i) => (
          <Disc key={`o${i}`}>
            <View style={[disc, { borderWidth: 1, borderStyle: "dashed", borderColor: OPEN }]} />
          </Disc>
        ))}
        {over ? (
          // Outlined like the others (solid, not dashed: it's players and spots, not one spot), so it
          // reads the same size.
          <View
            className="items-center justify-center bg-white"
            style={[disc, { borderWidth: 1, borderColor: OPEN }]}
          >
            <Text className={`${letter} text-ink-2`}>+{rest}</Text>
          </View>
        ) : null}
      </View>
    </LayoutAnimationConfig>
  );
}

// A joined player you can't see yet: diagonal lines across the disc, inside its outline.
function Hatched({ size }: { size: number }) {
  // useId gives ":r1:"; colons don't belong in an SVG url(#…).
  const clip = `hatch${useId().replace(/:/g, "")}`;
  const r = size / 2;
  const gap = size >= 30 ? 5 : 4;
  const lines = Array.from({ length: Math.ceil((size * 2) / gap) + 1 }, (_, i) => i * gap - size);
  return (
    <Svg width={size} height={size}>
      <Defs>
        <ClipPath id={clip}>
          <Circle cx={r} cy={r} r={r - 0.5} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clip})`}>
        {lines.map((x) => (
          <Line
            key={x}
            x1={x}
            y1={size}
            x2={x + size}
            y2={0}
            stroke={colors.ink}
            strokeOpacity={HATCH}
            strokeWidth={1.25}
          />
        ))}
      </G>
      <Circle
        cx={r}
        cy={r}
        r={r - 0.5}
        stroke={colors.ink}
        strokeOpacity={HATCH}
        strokeWidth={1}
        fill="none"
      />
    </Svg>
  );
}
