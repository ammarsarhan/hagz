import { Tabs } from "expo-router";
import { StatusBar } from "react-native";

export default function TabLayout() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <Tabs screenOptions={{ headerShown: false }} />
    </>
  );
}
