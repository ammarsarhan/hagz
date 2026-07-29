import { Stack } from "expo-router";

export default function DashboardLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="profile" options={{ presentation: 'modal' }}/>
        </Stack>
    )
}