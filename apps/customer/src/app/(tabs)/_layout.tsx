import { Tabs } from "expo-router";
import { TabBar } from "@/components/tab-bar";

// The customer app's five tabs (user, 2026-11-20): Home, Search, Community (open games until
// communities come in Phase 4b), Bookings and Account. Guests see all of them; signing in is asked
// for only where it's needed.
export default function CustomerTabs() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="bookings" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
