import { Redirect, Tabs } from "expo-router";
import { TabBar } from "@/components/tab-bar";
import { useCurrentVenue } from "@/lib/current-venue";

// A venue's five tabs (Figma "D3 · Venue tabs"): Home, Calendar, Venue, Payments, Account. Only for
// someone on a venue's team; anyone else (removed from their last venue, say) goes back to first run.
export default function VenueTabs() {
  const { venue, venues } = useCurrentVenue();
  if (venues.isSuccess && !venue) return <Redirect href="/home" />;

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="manage" />
      <Tabs.Screen name="payments" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
