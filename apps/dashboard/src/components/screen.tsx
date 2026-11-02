import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Every screen: white, clear of the notch and home indicator, with the Figma screens' 20px gutters.
// The gutters sit on an inner View because SafeAreaView is native and sets its own side padding
// from the insets, which would overwrite them (and className doesn't reach it anyway).
export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View className="flex-1 px-5">{children}</View>
    </SafeAreaView>
  );
}
