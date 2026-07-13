import { useAuth } from "@/context/AuthContext";
import { Stack } from "expo-router";

export default function OnboardingLayout() {
    const { user } = useAuth();

    const isManager = !!user && user.preferences.role === "MANAGER" && user.pitches.length <= 0;
    const isOwner = !!user && user.preferences.role === "OWNER" && user.pitches.length <= 0;

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#FFF" },
                gestureEnabled: false
            }}
        >
            <Stack.Protected guard={isManager}>
                <Stack.Screen name="manager" />
            </Stack.Protected>
            <Stack.Protected guard={isOwner}>
                <Stack.Screen name="owner" />
            </Stack.Protected>
        </Stack>
    )
}