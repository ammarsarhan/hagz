import { Stack } from "expo-router";
import { StatusBar } from "react-native";

export default function OwnerLayout() {
    return (
        <>
            <StatusBar barStyle={"dark-content"} />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFF" } }}>
                <Stack.Screen name="index"/>
                <Stack.Screen name="(modal)" options={{ presentation: 'modal' }} />
            </Stack>
        </>
    )
}