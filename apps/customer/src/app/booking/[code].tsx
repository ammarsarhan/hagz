import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

// A booking's share link, /booking/{code} (ROUTES.sharedBooking): the universal link lands here. Blank
// until the Phase 4 screens are built, like the empty tabs.
export default function SharedBookingScreen() {
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
    </View>
  );
}
