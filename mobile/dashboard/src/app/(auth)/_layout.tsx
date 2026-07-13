import { Stack } from "expo-router";
import { StatusBar } from "react-native";

export default function AuthLayout() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#FFF" },
          gestureEnabled: false
        }}
      >
        <Stack.Screen name="index"/>
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="sign-in" />
      </Stack>
    </>
  );
}
