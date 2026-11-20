import { Image } from "expo-image";
import { ActivityIndicator, Pressable, View } from "react-native";
import { reachable } from "@/lib/api";
import { colors } from "@/lib/colors";
import { IconCamera } from "./icons";
import { Text } from "./text";

// "Omar Hassan" → "OH", "Mona" → "M": the first letters of the first and last words.
const initialsOf = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const ends = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return ends.map((word) => Array.from(word ?? "")[0]?.toUpperCase() ?? "").join("");
};

const SIZE = 76;

// The Account tab's photo (Figma C7, 154:2): theirs, or their initials on the round buttons' grey,
// with a small black camera badge at its corner that says it can be changed. Busy while a new one
// uploads.
export function Avatar({
  name,
  url,
  busy = false,
  label,
  onPress,
}: {
  name: string;
  url: string | null;
  busy?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={busy}
      className="active:opacity-80"
    >
      <View
        className="items-center justify-center overflow-hidden rounded-full bg-chip"
        style={{ width: SIZE, height: SIZE }}
      >
        {url ? (
          <Image
            source={{ uri: reachable(url) }}
            style={{ width: SIZE, height: SIZE }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Text className="text-[26px] font-semibold">{initialsOf(name)}</Text>
        )}
        {busy ? (
          <View className="absolute inset-0 items-center justify-center bg-[#ffffffa0]">
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : null}
      </View>
      <View className="absolute -right-0.5 -bottom-0.5 size-7 items-center justify-center rounded-full border-2 border-white bg-ink">
        <IconCamera size={14} color={colors.white} strokeWidth={2} />
      </View>
    </Pressable>
  );
}
