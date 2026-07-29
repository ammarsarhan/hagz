import UserBoundary from "@/components/tabs/UserBoundary";
import { useAuth } from "@/context/AuthContext";
import { PitchProvider } from "@/context/PitchContext";
import { IconArrowsTransferUp, IconCalendar, IconHome, IconLayoutDashboard, IconUsers } from "@tabler/icons-react-native";
import { Tabs } from "expo-router";
import { StatusBar } from "react-native";

export default function TabLayout() {
  const { user } = useAuth();
  const isUser = user && user.preferences.role === "USER";

  if (isUser) {
    return <UserBoundary />;
  }

  return (
    <PitchProvider>
      <StatusBar barStyle="dark-content" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#1C04EA",
          tabBarInactiveTintColor: "#9CA3AF",
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopColor: "#E5E7EB",
          },
          sceneStyle: {
            backgroundColor: "#FFFFFF",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarLabel: "Home",
            tabBarIcon: ({ color, size }) => (
              <IconHome
                size={size - 2}
                color={color}
                strokeWidth={1.75}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="bookings"
          options={{
            title: "Bookings",
            tabBarLabel: "Bookings",
            tabBarIcon: ({ color, size }) => (
              <IconCalendar
                size={size - 2}
                color={color}
                strokeWidth={1.75}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="pitch"
          options={{
            title: "Pitch",
            tabBarLabel: "Pitch",
            tabBarIcon: ({ color, size }) => (
              <IconLayoutDashboard
                size={size - 2}
                color={color}
                strokeWidth={1.75}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="team"
          options={{
            title: "Team",
            tabBarLabel: "Team",
            tabBarIcon: ({ color, size }) => (
              <IconUsers
                size={size - 2}
                color={color}
                strokeWidth={1.75}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="payouts"
          options={{
            title: "Payouts",
            tabBarLabel: "Payouts",
            tabBarIcon: ({ color, size }) => (
              <IconArrowsTransferUp
                size={size - 2}
                color={color}
                strokeWidth={1.75}
              />
            ),
          }}
        />
      </Tabs>
    </PitchProvider>
  );
}