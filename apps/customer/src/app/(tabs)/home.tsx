import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

// Home, blank until it's designed (user, 2026-11-20). The app opens here; Search finds venues, and
// Account has signing in and out.
export default function Home() {
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
    </View>
  );
}
