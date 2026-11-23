import { useId } from "react";
import { View } from "react-native";
import Svg, { Circle, ClipPath, Defs, G, Line } from "react-native-svg";
import { colors } from "@/lib/colors";
import { Text } from "./text";

// An open game's spots (Figma C11, the signature): the booker as an outlined disc, each player
// who's joined black with their initial, each spot still open dashed. A player whose name isn't
// shown yet (until you join) is hatched in grey: there, but not who.

const OPEN = "#b5b9bf";
// The hatching, faint: someone's there, but quieter than a named player.
const HATCH = 0.35;

export function SpotsRow({
  booker,
  joined,
  names,
  open,
  size = 22,
}: {
  booker: string;
  joined: number;
  // The joined players' first names, when they may be shown.
  names: string[] | null;
  open: number;
  size?: number;
}) {
  const disc = { width: size, height: size, borderRadius: size / 2 };
  const letter = `${size >= 30 ? "text-[13px]" : "text-[10px]"} font-semibold`;
  const initial = (name: string) => name.trim().charAt(0).toUpperCase();
  return (
    <View
      className="flex-row"
      style={{ gap: size >= 30 ? 6 : 4 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View className="items-center justify-center border border-ink bg-white" style={disc}>
        <Text className={letter}>{initial(booker)}</Text>
      </View>
      {Array.from({ length: joined }, (_, i) =>
        names?.[i] ? (
          <View key={`j${i}`} className="items-center justify-center bg-ink" style={disc}>
            <Text className={`${letter} text-white`}>{initial(names[i])}</Text>
          </View>
        ) : (
          <Hatched key={`j${i}`} size={size} />
        ),
      )}
      {Array.from({ length: open }, (_, i) => (
        <View
          key={`o${i}`}
          style={[disc, { borderWidth: 1, borderStyle: "dashed", borderColor: OPEN }]}
        />
      ))}
    </View>
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
