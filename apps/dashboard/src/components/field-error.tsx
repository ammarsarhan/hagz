import { View } from "react-native";
import { colors } from "@/lib/colors";
import { IconAlertCircle } from "./icons";
import { Text } from "./text";

// Under a field or the code boxes: red 14px text with a small icon, for problems the person can fix.
export function FieldError({ children }: { children: string }) {
  return (
    <View accessibilityRole="alert" className="mb-4 mt-2 flex-row items-start gap-1.5">
      <IconAlertCircle size={16} color={colors.red} strokeWidth={2} style={{ marginTop: 1.5 }} />
      <Text className="flex-1 text-label text-red">{children}</Text>
    </View>
  );
}
