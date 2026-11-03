import { View } from "react-native";
import { Text } from "./text";

// "Ammar Yasser" → "AY", "Mona" → "M": the first letters of the first and last words.
const initialsOf = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const ends = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return ends.map((word) => Array.from(word ?? "")[0]?.toUpperCase() ?? "").join("");
};

// Staff have no photo: their initials on the same grey as the round buttons. Small (40, one initial)
// beside the round buttons in the nav bar; large (76, both initials) atop the account screen.
export function Avatar({ name, size = "small" }: { name: string; size?: "small" | "large" }) {
  if (size === "large") {
    return (
      <View className="size-[76px] items-center justify-center rounded-full bg-chip">
        <Text className="text-[26px] font-semibold">{initialsOf(name)}</Text>
      </View>
    );
  }
  return (
    <View className="size-10 items-center justify-center rounded-full bg-chip">
      <Text className="text-[15px] font-medium">
        {Array.from(name.trim())[0]?.toUpperCase() ?? ""}
      </Text>
    </View>
  );
}
