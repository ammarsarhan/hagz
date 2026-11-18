import { Redirect, Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { TabBar } from "@/components/tab-bar";
import { useCurrentVenue } from "@/lib/current-venue";

// A venue's five tabs (Figma "D3 · Venue tabs"): Home, Calendar, Venue, Payments, Account. Only for
// someone on a venue's team; anyone else (removed from their last venue, say) goes back to first run.
//
// While the venue switcher is open, the whole venue (screen and tab bar) recedes behind it: it
// shrinks, rounds its corners and tips back a touch over black, like a card set down, and comes
// forward again when the switcher closes. The tab bar drives `depth` (0 at rest, 1 receded).
const RECEDED_SCALE = 0.9;
const RECEDED_RADIUS = 44;
const RECEDED_TILT = 6;

export default function VenueTabs() {
  const { venue, ready } = useCurrentVenue();
  const depth = useSharedValue(0);
  // Light status bar text while the black shows around the receded venue.
  const [receded, setReceded] = useState(false);
  const recede = useAnimatedStyle(() => ({
    borderRadius: interpolate(depth.value, [0, 1], [0, RECEDED_RADIUS]),
    transform: [
      { perspective: 900 },
      { scale: interpolate(depth.value, [0, 1], [1, RECEDED_SCALE]) },
      { rotateX: `${interpolate(depth.value, [0, 1], [0, RECEDED_TILT])}deg` },
    ],
  }));

  if (ready && !venue) return <Redirect href="/home" />;

  return (
    <View className="flex-1 bg-black">
      {receded ? <StatusBar style="light" /> : null}
      <Animated.View className="flex-1 overflow-hidden bg-white" style={recede}>
        <Tabs
          tabBar={(props) => <TabBar {...props} depth={depth} onRecede={setReceded} />}
          screenOptions={{ headerShown: false }}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="calendar" />
          <Tabs.Screen name="manage" />
          <Tabs.Screen name="payments" />
          <Tabs.Screen name="account" />
        </Tabs>
      </Animated.View>
    </View>
  );
}
