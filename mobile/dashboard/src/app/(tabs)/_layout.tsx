import UserBoundary from "@/components/tabs/UserBoundary";
import { useAuth } from "@/context/AuthContext";
import { Tabs } from "expo-router";
import { StatusBar } from "react-native";



export default function TabLayout() {
  const { user } = useAuth();
  const isUser = user && user.preferences.role === "USER";

  if (isUser) {
    return <UserBoundary />
  };

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <Tabs screenOptions={{ headerShown: false }} />
    </>
  );
}
