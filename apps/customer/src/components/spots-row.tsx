import { View } from "react-native";
import { Text } from "./text";

// An open game's spots (Figma C11, the signature): the booker as an outlined disc, each player
// who's joined black, each spot still open dashed. Initials where the names are known (once you've
// joined); a plain black disc where they aren't.

const OPEN = "#b5b9bf";

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
      {Array.from({ length: joined }, (_, i) => (
        <View key={`j${i}`} className="items-center justify-center bg-ink" style={disc}>
          {names?.[i] ? <Text className={`${letter} text-white`}>{initial(names[i])}</Text> : null}
        </View>
      ))}
      {Array.from({ length: open }, (_, i) => (
        <View
          key={`o${i}`}
          style={[disc, { borderWidth: 1, borderStyle: "dashed", borderColor: OPEN }]}
        />
      ))}
    </View>
  );
}
