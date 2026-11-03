import { Text } from "./text";
import { View } from "react-native";

// Staff have no photo: their initial on the same grey as the round buttons it sits beside.
export function Avatar({ name }: { name: string }) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "";
  return (
    <View className="size-10 items-center justify-center rounded-full bg-chip">
      <Text className="text-[15px] font-medium">{initial}</Text>
    </View>
  );
}
